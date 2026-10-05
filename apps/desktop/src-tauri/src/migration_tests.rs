use sqlx::{
    migrate::{Migration, MigrationType, Migrator},
    Connection, SqliteConnection,
};

fn migrator(through: i64) -> Migrator {
    Migrator {
        migrations: super::database_migrations()
            .into_iter()
            .filter(|migration| i64::from(migration.version) <= through)
            .map(|migration| {
                Migration::new(
                    i64::from(migration.version),
                    migration.description.into(),
                    MigrationType::Simple,
                    migration.sql.into(),
                    false,
                )
            })
            .collect::<Vec<_>>()
            .into(),
        ..Migrator::DEFAULT
    }
}

#[test]
fn startup_accepts_previously_applied_sales_migration() {
    tauri::async_runtime::block_on(async {
        let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
        migrator(34).run(&mut db).await.unwrap();

        // Historical checksum from the sales-workflow branch. Startup must retain
        // this migration unchanged, even when the sales UI is not in this checkout.
        sqlx::query("INSERT INTO _sqlx_migrations(version, description, success, checksum, execution_time) VALUES (35, 'sales_workflow', 1, X'F29A6248CF930CC1DE5076CB59F3D5D227427217EE6C021B73C63176DFC56C9D9B15180DB2B3B6C3E18C8CD9C788893A', 0)")
            .execute(&mut db).await.unwrap();

        migrator(i64::MAX)
            .run(&mut db)
            .await
            .expect("startup must accept the existing sales migration history");
    });
}

#[test]
fn fresh_database_includes_sales_schema_and_can_reopen() {
    tauri::async_runtime::block_on(async {
        let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
        let migrations = migrator(i64::MAX);
        migrations.run(&mut db).await.unwrap();
        for table in [
            "sales_documents",
            "sales_document_lifecycle",
            "sales_idempotency",
        ] {
            sqlx::query(&format!("SELECT * FROM {table} LIMIT 0"))
                .execute(&mut db)
                .await
                .expect("sales schema must exist");
        }
        migrations
            .run(&mut db)
            .await
            .expect("reopening must not reapply migrations");
    });
}
