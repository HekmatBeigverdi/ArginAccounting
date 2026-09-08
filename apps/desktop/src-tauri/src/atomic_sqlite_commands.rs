use std::{collections::HashMap, sync::atomic::{AtomicU64, Ordering}};

use serde_json::{Map, Number, Value};
use sqlx::{Column, Row, Sqlite, TypeInfo, ValueRef, pool::PoolConnection};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct AtomicSqliteTransactions {
    next_id: AtomicU64,
    connections: Mutex<HashMap<u64, PoolConnection<Sqlite>>>,
}

fn bind_value<'q>(
    mut query: sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
    value: &'q Value,
) -> Result<sqlx::query::Query<'q, Sqlite, sqlx::sqlite::SqliteArguments<'q>>, String> {
    query = match value {
        Value::Null => query.bind(Option::<String>::None),
        Value::Bool(value) => query.bind(*value),
        Value::String(value) => query.bind(value.clone()),
        Value::Number(value) => {
            if let Some(integer) = value.as_i64() {
                query.bind(integer)
            } else if let Some(unsigned) = value.as_u64() {
                let integer = i64::try_from(unsigned).map_err(|_| "numeric parameter is outside SQLite INTEGER range".to_string())?;
                query.bind(integer)
            } else {
                query.bind(value.as_f64().ok_or_else(|| "invalid numeric parameter".to_string())?)
            }
        }
        Value::Array(values) => {
            let mut bytes = Vec::with_capacity(values.len());
            for item in values {
                let byte = item.as_u64().and_then(|v| u8::try_from(v).ok())
                    .ok_or_else(|| "binary parameters must contain byte values".to_string())?;
                bytes.push(byte);
            }
            query.bind(bytes)
        }
        Value::Object(_) => return Err("object database parameters are not supported".to_string()),
    };
    Ok(query)
}

fn row_to_json(row: &sqlx::sqlite::SqliteRow) -> Result<Value, String> {
    let mut object = Map::new();
    for (index, column) in row.columns().iter().enumerate() {
        let raw = row.try_get_raw(index).map_err(|error| error.to_string())?;
        let value = if raw.is_null() {
            Value::Null
        } else {
            match raw.type_info().name().to_ascii_uppercase().as_str() {
                "INTEGER" | "INT" => Value::Number(Number::from(row.try_get::<i64, _>(index).map_err(|error| error.to_string())?)),
                "REAL" | "FLOAT" | "DOUBLE" => {
                    let value = row.try_get::<f64, _>(index).map_err(|error| error.to_string())?;
                    Value::Number(Number::from_f64(value).ok_or_else(|| "SQLite returned a non-finite REAL".to_string())?)
                }
                "BLOB" => Value::Array(row.try_get::<Vec<u8>, _>(index).map_err(|error| error.to_string())?
                    .into_iter().map(|byte| Value::Number(Number::from(byte))).collect()),
                _ => Value::String(row.try_get::<String, _>(index).map_err(|error| error.to_string())?),
            }
        };
        object.insert(column.name().to_string(), value);
    }
    Ok(Value::Object(object))
}

#[tauri::command]
pub async fn atomic_sqlite_begin(
    db_instances: State<'_, DbInstances>,
    transactions: State<'_, AtomicSqliteTransactions>,
    db: String,
) -> Result<u64, String> {
    let pool = {
        let instances = db_instances.0.read().await;
        match instances.get(&db).ok_or_else(|| format!("database is not loaded: {db}"))? {
            DbPool::Sqlite(pool) => pool.clone(),
            #[allow(unreachable_patterns)]
            _ => return Err("atomic SQLite transactions require the SQLite driver".to_string()),
        }
    };

    let mut connection = pool.acquire().await.map_err(|error| error.to_string())?;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *connection)
        .await
        .map_err(|error| error.to_string())?;

    let id = transactions.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    transactions.connections.lock().await.insert(id, connection);
    Ok(id)
}

#[tauri::command]
pub async fn atomic_sqlite_execute(
    transactions: State<'_, AtomicSqliteTransactions>,
    transaction_id: u64,
    query: String,
    values: Vec<Value>,
) -> Result<(u64, i64), String> {
    let mut connections = transactions.connections.lock().await;
    let connection = connections.get_mut(&transaction_id).ok_or_else(|| "atomic SQLite transaction not found".to_string())?;
    let mut statement = sqlx::query(&query);
    for value in &values {
        statement = bind_value(statement, value)?;
    }
    let result = statement.execute(&mut **connection).await.map_err(|error| error.to_string())?;
    Ok((result.rows_affected(), result.last_insert_rowid()))
}

#[tauri::command]
pub async fn atomic_sqlite_select(
    transactions: State<'_, AtomicSqliteTransactions>,
    transaction_id: u64,
    query: String,
    values: Vec<Value>,
) -> Result<Vec<Value>, String> {
    let mut connections = transactions.connections.lock().await;
    let connection = connections.get_mut(&transaction_id).ok_or_else(|| "atomic SQLite transaction not found".to_string())?;
    let mut statement = sqlx::query(&query);
    for value in &values {
        statement = bind_value(statement, value)?;
    }
    let rows = statement.fetch_all(&mut **connection).await.map_err(|error| error.to_string())?;
    rows.iter().map(row_to_json).collect()
}

async fn finish(
    transactions: &AtomicSqliteTransactions,
    transaction_id: u64,
    sql: &str,
) -> Result<(), String> {
    let mut connection = transactions.connections.lock().await.remove(&transaction_id)
        .ok_or_else(|| "atomic SQLite transaction not found".to_string())?;
    sqlx::query(sql).execute(&mut *connection).await.map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn atomic_sqlite_commit(
    transactions: State<'_, AtomicSqliteTransactions>,
    transaction_id: u64,
) -> Result<(), String> {
    finish(&transactions, transaction_id, "COMMIT").await
}

#[tauri::command]
pub async fn atomic_sqlite_rollback(
    transactions: State<'_, AtomicSqliteTransactions>,
    transaction_id: u64,
) -> Result<(), String> {
    finish(&transactions, transaction_id, "ROLLBACK").await
}
