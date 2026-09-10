use sqlx::{Connection, Executor, Row, SqliteConnection};

fn run_async<T>(future: impl std::future::Future<Output = T>) -> T {
    tauri::async_runtime::block_on(future)
}

async fn performance_database() -> SqliteConnection {
    let mut db = SqliteConnection::connect("sqlite::memory:")
        .await
        .expect("open performance database");
    sqlx::raw_sql(
        r#"
        CREATE TABLE inventory_stock_movements (
            movement_id TEXT PRIMARY KEY NOT NULL,
            company_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            line_id TEXT NOT NULL,
            transfer_id TEXT,
            reversal_of_movement_id TEXT,
            product_id TEXT NOT NULL,
            warehouse_id TEXT NOT NULL,
            zone_id TEXT,
            location_id TEXT,
            business_date TEXT NOT NULL,
            business_order INTEGER NOT NULL,
            recorded_at TEXT NOT NULL,
            quantity_delta TEXT NOT NULL
        );
        CREATE INDEX ix_inventory_stock_movements_stock_kardex
        ON inventory_stock_movements(
            company_id, product_id, warehouse_id, zone_id, location_id,
            business_date, business_order, document_id, line_id, movement_id
        );
        CREATE INDEX ix_inventory_stock_movements_product_date
        ON inventory_stock_movements(company_id, product_id, business_date, business_order, movement_id);

        CREATE TABLE inventory_stock_movement_compensations (
            movement_id TEXT PRIMARY KEY NOT NULL,
            company_id TEXT NOT NULL,
            effect_document_id TEXT NOT NULL,
            source_line_id TEXT NOT NULL,
            original_movement_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            warehouse_id TEXT NOT NULL,
            zone_id TEXT,
            location_id TEXT,
            business_date TEXT NOT NULL,
            business_order INTEGER NOT NULL,
            recorded_at TEXT NOT NULL,
            quantity_delta TEXT NOT NULL
        );
        CREATE INDEX ix_inventory_compensation_stock_kardex
        ON inventory_stock_movement_compensations(
            company_id, product_id, warehouse_id, zone_id, location_id,
            business_date, business_order, effect_document_id, source_line_id, movement_id
        );

        CREATE VIEW inventory_all_stock_movements AS
        SELECT movement_id, company_id, document_id, line_id, transfer_id,
               reversal_of_movement_id, product_id, warehouse_id, zone_id, location_id,
               business_date, business_order, recorded_at, quantity_delta
        FROM inventory_stock_movements
        UNION ALL
        SELECT movement_id, company_id, effect_document_id AS document_id,
               source_line_id AS line_id, NULL AS transfer_id,
               original_movement_id AS reversal_of_movement_id,
               product_id, warehouse_id, zone_id, location_id,
               business_date, business_order, recorded_at, quantity_delta
        FROM inventory_stock_movement_compensations;
        "#,
    )
    .execute(&mut db)
    .await
    .expect("create inventory performance schema");
    db
}

async fn seed_movements(db: &mut SqliteConnection, count: usize) {
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *db)
        .await
        .expect("begin seed transaction");
    for index in 0..count {
        let company = if index % 10 == 0 { "company-other" } else { "company-a" };
        let product = if index % 7 == 0 { "product-other" } else { "product-a" };
        let warehouse = if index % 5 == 0 { "warehouse-other" } else { "warehouse-a" };
        let day = 1 + (index % 28);
        sqlx::query(
            "INSERT INTO inventory_stock_movements(movement_id,company_id,document_id,line_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES(?,?,?,?,?,?,?,?,'2026-09-10T12:00:00.000Z',?)",
        )
        .bind(format!("movement-{index:06}"))
        .bind(company)
        .bind(format!("document-{index:06}"))
        .bind(format!("line-{index:06}"))
        .bind(product)
        .bind(warehouse)
        .bind(format!("2026-08-{day:02}"))
        .bind((index % 1000 + 1) as i64)
        .bind(if index % 3 == 0 { "-1.25" } else { "2.5" })
        .execute(&mut *db)
        .await
        .expect("seed movement");
    }
    sqlx::query("COMMIT")
        .execute(&mut *db)
        .await
        .expect("commit seed transaction");
}

fn explain_text(rows: &[sqlx::sqlite::SqliteRow]) -> String {
    rows.iter()
        .map(|row| row.get::<String, _>("detail"))
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn representative_kardex_query_is_bounded_and_uses_stock_key_indexes() {
    run_async(async {
        let mut db = performance_database().await;
        seed_movements(&mut db, 20_000).await;

        let plan = sqlx::query(
            r#"EXPLAIN QUERY PLAN
            SELECT m.movement_id,m.business_date,m.business_order,m.document_id,m.line_id,m.quantity_delta
            FROM inventory_all_stock_movements m
            WHERE m.company_id=? AND m.product_id=? AND m.warehouse_id=?
              AND m.zone_id IS NULL AND m.location_id IS NULL
              AND m.business_date>=? AND m.business_date<=?
            ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id
            LIMIT ?"#,
        )
        .bind("company-a")
        .bind("product-a")
        .bind("warehouse-a")
        .bind("2026-08-01")
        .bind("2026-08-31")
        .bind(101_i64)
        .fetch_all(&mut db)
        .await
        .expect("explain kardex query");
        let detail = explain_text(&plan);
        assert!(
            detail.contains("ix_inventory_stock_movements_stock_kardex"),
            "primary movement partition must use the stock-key chronology index; plan={detail}"
        );
        assert!(
            detail.contains("ix_inventory_compensation_stock_kardex"),
            "compensation partition must use the stock-key chronology index; plan={detail}"
        );

        let rows = sqlx::query(
            r#"SELECT m.movement_id
            FROM inventory_all_stock_movements m
            WHERE m.company_id=? AND m.product_id=? AND m.warehouse_id=?
              AND m.zone_id IS NULL AND m.location_id IS NULL
              AND m.business_date>=? AND m.business_date<=?
            ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id
            LIMIT ?"#,
        )
        .bind("company-a")
        .bind("product-a")
        .bind("warehouse-a")
        .bind("2026-08-01")
        .bind("2026-08-31")
        .bind(101_i64)
        .fetch_all(&mut db)
        .await
        .expect("run representative kardex query");
        assert!(rows.len() <= 101, "query must remain explicitly bounded");
    });
}

#[test]
fn product_date_lookup_uses_company_product_date_index_on_large_history() {
    run_async(async {
        let mut db = performance_database().await;
        seed_movements(&mut db, 20_000).await;

        let plan = sqlx::query(
            "EXPLAIN QUERY PLAN SELECT movement_id FROM inventory_stock_movements WHERE company_id=? AND product_id=? AND business_date>=? ORDER BY business_date,business_order,movement_id LIMIT 500",
        )
        .bind("company-a")
        .bind("product-a")
        .bind("2026-08-10")
        .fetch_all(&mut db)
        .await
        .expect("explain product chronology query");
        let detail = explain_text(&plan);
        assert!(
            detail.contains("ix_inventory_stock_movements_product_date"),
            "product chronology lookup must use its covering prefix index; plan={detail}"
        );
    });
}
