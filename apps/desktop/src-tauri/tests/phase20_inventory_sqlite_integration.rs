use std::{path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

use sqlx::{Connection, Row, SqliteConnection};

const MIGRATIONS: [&str; 27] = [
    include_str!("../migrations/0001_initialize_database.sql"),
    include_str!("../migrations/0002_company_and_branch.sql"),
    include_str!("../migrations/0003_fiscal_management.sql"),
    include_str!("../migrations/0004_security.sql"),
    include_str!("../migrations/0005_audit_and_approval.sql"),
    include_str!("../migrations/0006_approval_optimistic_concurrency.sql"),
    include_str!("../migrations/0007_background_jobs.sql"),
    include_str!("../migrations/0008_notifications.sql"),
    include_str!("../migrations/0009_background_job_context.sql"),
    include_str!("../migrations/0010_chart_of_accounts.sql"),
    include_str!("../migrations/0011_accounting_dimensions.sql"),
    include_str!("../migrations/0012_coding_templates.sql"),
    include_str!("../migrations/0013_journal_vouchers.sql"),
    include_str!("../migrations/0014_journal_lifecycle.sql"),
    include_str!("../migrations/0015_accounting_report_indexes.sql"),
    include_str!("../migrations/0016_parties.sql"),
    include_str!("../migrations/0017_party_sync_metadata.sql"),
    include_str!("../migrations/0018_taxpayer_unit_reference_data.sql"),
    include_str!("../migrations/0019_products_services.sql"),
    include_str!("../migrations/0020_product_sync_metadata.sql"),
    include_str!("../migrations/0021_product_idempotency.sql"),
    include_str!("../migrations/0022_warehouses.sql"),
    include_str!("../migrations/0023_warehouse_sync_metadata.sql"),
    include_str!("../migrations/0024_warehouse_idempotency.sql"),
    include_str!("../migrations/0025_warehouse_maintenance_tombstones.sql"),
    include_str!("../migrations/0026_inventory_documents.sql"),
    include_str!("../migrations/0027_inventory_reversal_persistence.sql"),
];

fn run_async<T>(future: impl std::future::Future<Output = T>) -> T {
    tauri::async_runtime::block_on(future)
}

async fn memory_database_through(last_version: usize) -> SqliteConnection {
    let mut connection = SqliteConnection::connect("sqlite::memory:").await.expect("open in-memory SQLite");
    sqlx::query("PRAGMA foreign_keys = ON").execute(&mut connection).await.expect("enable foreign keys");
    apply_migrations(&mut connection, 0, last_version).await;
    connection
}

async fn apply_migrations(connection: &mut SqliteConnection, start: usize, end: usize) {
    for sql in &MIGRATIONS[start..end] {
        sqlx::raw_sql(sql).execute(&mut *connection).await.expect("migration must execute on real SQLite");
    }
}

async fn seed_company_master_data(connection: &mut SqliteConnection, suffix: &str) {
    let company = format!("company-{suffix}");
    let branch = format!("branch-{suffix}");
    let fiscal_year = format!("fy-{suffix}");
    let fiscal_period = format!("fp-{suffix}");
    let product = format!("product-{suffix}");
    let warehouse = format!("warehouse-{suffix}");
    let now = "2026-09-10T12:00:00.000Z";

    sqlx::query("INSERT INTO companies(id,code,legal_name,base_currency,locale,calendar,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(&company).bind(format!("C-{suffix}")).bind(format!("Company {suffix}"))
        .bind("IRR").bind("fa-IR").bind("jalali").bind("active").bind(now).bind(now)
        .execute(&mut *connection).await.expect("seed company");
    sqlx::query("INSERT INTO branches(id,company_id,code,name,is_head_office,status,created_at,updated_at) VALUES(?,?,?,?,1,'active',?,?)")
        .bind(&branch).bind(&company).bind(format!("B-{suffix}")).bind(format!("Branch {suffix}"))
        .bind(now).bind(now).execute(&mut *connection).await.expect("seed branch");
    sqlx::query("INSERT INTO fiscal_years(id,company_id,code,title,start_date,end_date,status,is_current,created_at,updated_at) VALUES(?,?,?,?,? ,?,'open',1,?,?)")
        .bind(&fiscal_year).bind(&company).bind(format!("Y-{suffix}")).bind(format!("Year {suffix}"))
        .bind("2026-01-01").bind("2026-12-31").bind(now).bind(now)
        .execute(&mut *connection).await.expect("seed fiscal year");
    sqlx::query("INSERT INTO fiscal_periods(id,fiscal_year_id,sequence,code,title,start_date,end_date,status,created_at,updated_at) VALUES(?,?,1,?,?,?,?,'open',?,?)")
        .bind(&fiscal_period).bind(&fiscal_year).bind(format!("P-{suffix}")).bind(format!("Period {suffix}"))
        .bind("2026-01-01").bind("2026-12-31").bind(now).bind(now)
        .execute(&mut *connection).await.expect("seed fiscal period");
    sqlx::query("INSERT INTO products(id,company_id,code,title,kind,status,purchasable,sellable,created_at,updated_at,version) VALUES(?,?,?,?,'product','active',1,1,?,?,1)")
        .bind(&product).bind(&company).bind(format!("P-{suffix}")).bind(format!("Product {suffix}"))
        .bind(now).bind(now).execute(&mut *connection).await.expect("seed product");
    sqlx::query("INSERT INTO warehouses(id,company_id,code,title,kind,status,organizational_scope,branch_id,created_at,updated_at,version) VALUES(?,?,?,?,'general','active','branch',?,?,?,1)")
        .bind(&warehouse).bind(&company).bind(format!("W-{suffix}")).bind(format!("Warehouse {suffix}"))
        .bind(&branch).bind(now).bind(now).execute(&mut *connection).await.expect("seed warehouse");
}

async fn insert_document(connection: &mut SqliteConnection, suffix: &str, document_id: &str, document_type: &str, status: &str, number: Option<&str>) {
    let now = "2026-09-10T12:00:00.000Z";
    sqlx::query("INSERT INTO inventory_documents(id,company_id,document_type,status,document_number,business_date,origin_branch_id,fiscal_year_id,fiscal_period_id,version,created_at,updated_at) VALUES(?,?,?,?,?,'2026-09-10',?,?,?,?,?,?)")
        .bind(document_id)
        .bind(format!("company-{suffix}"))
        .bind(document_type)
        .bind(status)
        .bind(number)
        .bind(format!("branch-{suffix}"))
        .bind(format!("fy-{suffix}"))
        .bind(format!("fp-{suffix}"))
        .bind(1_i64)
        .bind(now)
        .bind(now)
        .execute(&mut *connection).await.expect("insert inventory document");
}

async fn insert_line(connection: &mut SqliteConnection, suffix: &str, document_id: &str, line_id: &str, position: i64) {
    sqlx::query("INSERT INTO inventory_document_lines(id,company_id,document_id,position,product_id,entered_quantity,base_quantity,entered_unit_id,base_unit_id,quantity_snapshot,warehouse_id) VALUES(?,?,?,?,?,'1','1','unit-ea','unit-ea','{}',?)")
        .bind(line_id)
        .bind(format!("company-{suffix}"))
        .bind(document_id)
        .bind(position)
        .bind(format!("product-{suffix}"))
        .bind(format!("warehouse-{suffix}"))
        .execute(&mut *connection).await.expect("insert inventory line");
}

async fn insert_movement(connection: &mut SqliteConnection, suffix: &str, movement_id: &str, document_id: &str, line_id: &str, transfer_id: Option<&str>, quantity: &str, order: i64) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO inventory_stock_movements(movement_id,company_id,document_id,line_id,transfer_id,reversal_of_movement_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES(?,?,?,?,?,NULL,?,?,'2026-09-10',?,'2026-09-10T12:01:00.000Z',?)")
        .bind(movement_id)
        .bind(format!("company-{suffix}"))
        .bind(document_id)
        .bind(line_id)
        .bind(transfer_id)
        .bind(format!("product-{suffix}"))
        .bind(format!("warehouse-{suffix}"))
        .bind(order)
        .bind(quantity)
        .execute(&mut *connection).await.map(|_| ())
}

#[test]
fn upgrades_real_sqlite_from_phase19_schema_to_inventory_schema_without_losing_master_data() {
    run_async(async {
        let mut db = memory_database_through(25).await;
        seed_company_master_data(&mut db, "a").await;
        let absent: Option<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_documents'")
            .fetch_optional(&mut db).await.expect("inspect pre-upgrade schema");
        assert!(absent.is_none());

        apply_migrations(&mut db, 25, 27).await;

        let company: String = sqlx::query_scalar("SELECT legal_name FROM companies WHERE id='company-a'")
            .fetch_one(&mut db).await.expect("pre-existing company survives upgrade");
        assert_eq!(company, "Company a");
        let view: String = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='view' AND name='inventory_all_stock_movements'")
            .fetch_one(&mut db).await.expect("unified movement view exists");
        assert_eq!(view, "inventory_all_stock_movements");
        let compensation: String = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_stock_movement_compensations'")
            .fetch_one(&mut db).await.expect("reversal partition exists");
        assert_eq!(compensation, "inventory_stock_movement_compensations");
    });
}

#[test]
fn inventory_constraints_enforce_number_uniqueness_company_isolation_and_append_only_history() {
    run_async(async {
        let mut db = memory_database_through(27).await;
        seed_company_master_data(&mut db, "a").await;
        seed_company_master_data(&mut db, "b").await;
        insert_document(&mut db, "a", "doc-a1", "receipt", "confirmed", Some("REC-0001")).await;
        insert_line(&mut db, "a", "doc-a1", "line-a1", 1).await;
        insert_movement(&mut db, "a", "move-a1", "doc-a1", "line-a1", None, "5", 1).await.expect("seed movement");

        let duplicate_number = sqlx::query("INSERT INTO inventory_documents(id,company_id,document_type,status,document_number,business_date,origin_branch_id,fiscal_year_id,fiscal_period_id,version,created_at,updated_at) VALUES('doc-a2','company-a','receipt','draft','REC-0001','2026-09-10','branch-a','fy-a','fp-a',1,'2026-09-10T12:00:00.000Z','2026-09-10T12:00:00.000Z')")
            .execute(&mut db).await;
        assert!(duplicate_number.is_err(), "same scoped document number must be unique");

        insert_document(&mut db, "b", "doc-b1", "receipt", "draft", Some("REC-0001")).await;
        let cross_company_line = sqlx::query("INSERT INTO inventory_document_lines(id,company_id,document_id,position,product_id) VALUES('bad-line','company-a','doc-a1',2,'product-b')")
            .execute(&mut db).await;
        assert!(cross_company_line.is_err(), "composite foreign keys must isolate Company data");

        let update_history = sqlx::query("UPDATE inventory_stock_movements SET quantity_delta='6' WHERE movement_id='move-a1'")
            .execute(&mut db).await;
        assert!(update_history.is_err(), "confirmed movement history must be append-only");
        let delete_history = sqlx::query("DELETE FROM inventory_stock_movements WHERE movement_id='move-a1'")
            .execute(&mut db).await;
        assert!(delete_history.is_err(), "confirmed movement history must not be physically deleted");
    });
}

#[test]
fn failed_transfer_transaction_rolls_back_document_lines_movements_and_projection_together() {
    run_async(async {
        let mut db = memory_database_through(27).await;
        seed_company_master_data(&mut db, "a").await;
        sqlx::query("INSERT INTO warehouses(id,company_id,code,title,kind,status,organizational_scope,branch_id,created_at,updated_at,version) VALUES('warehouse-a2','company-a','W-A2','Warehouse A2','general','active','branch','branch-a','2026-09-10T12:00:00.000Z','2026-09-10T12:00:00.000Z',1)")
            .execute(&mut db).await.expect("seed destination warehouse");

        sqlx::query("BEGIN IMMEDIATE").execute(&mut db).await.expect("begin atomic inventory transaction");
        insert_document(&mut db, "a", "transfer-fail", "transfer", "confirmed", Some("TR-FAIL")).await;
        insert_line(&mut db, "a", "transfer-fail", "transfer-line", 1).await;
        insert_movement(&mut db, "a", "transfer-source", "transfer-fail", "transfer-line", Some("transfer-1"), "-2", 1).await.expect("source fact inserted inside transaction");
        let destination_failure = sqlx::query("INSERT INTO inventory_stock_movements(movement_id,company_id,document_id,line_id,transfer_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES('transfer-destination','company-a','transfer-fail','transfer-line','transfer-1','product-a','missing-warehouse','2026-09-10',1,'2026-09-10T12:01:00.000Z','2')")
            .execute(&mut db).await;
        assert!(destination_failure.is_err(), "destination failure must be observable before rollback");
        sqlx::query("ROLLBACK").execute(&mut db).await.expect("rollback inventory transaction");

        let documents: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_documents WHERE id='transfer-fail'")
            .fetch_one(&mut db).await.expect("count rolled-back document");
        let movements: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_stock_movements WHERE transfer_id='transfer-1'")
            .fetch_one(&mut db).await.expect("count rolled-back movements");
        assert_eq!(documents, 0);
        assert_eq!(movements, 0);
    });
}

#[test]
fn successful_transfer_is_persisted_as_two_conserving_facts_and_reversal_is_visible_only_as_compensation() {
    run_async(async {
        let mut db = memory_database_through(27).await;
        seed_company_master_data(&mut db, "a").await;
        sqlx::query("INSERT INTO warehouses(id,company_id,code,title,kind,status,organizational_scope,branch_id,created_at,updated_at,version) VALUES('warehouse-a2','company-a','W-A2','Warehouse A2','general','active','branch','branch-a','2026-09-10T12:00:00.000Z','2026-09-10T12:00:00.000Z',1)")
            .execute(&mut db).await.expect("seed destination warehouse");
        insert_document(&mut db, "a", "transfer-ok", "transfer", "confirmed", Some("TR-0001")).await;
        insert_line(&mut db, "a", "transfer-ok", "transfer-line", 1).await;

        sqlx::query("BEGIN IMMEDIATE").execute(&mut db).await.expect("begin transfer transaction");
        insert_movement(&mut db, "a", "move-source", "transfer-ok", "transfer-line", Some("transfer-ok-id"), "-3", 1).await.expect("source movement");
        sqlx::query("INSERT INTO inventory_stock_movements(movement_id,company_id,document_id,line_id,transfer_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES('move-destination','company-a','transfer-ok','transfer-line','transfer-ok-id','product-a','warehouse-a2','2026-09-10',1,'2026-09-10T12:01:00.000Z','3')")
            .execute(&mut db).await.expect("destination movement");
        sqlx::query("COMMIT").execute(&mut db).await.expect("commit transfer transaction");

        let rows = sqlx::query("SELECT quantity_delta FROM inventory_stock_movements WHERE transfer_id='transfer-ok-id' ORDER BY movement_id")
            .fetch_all(&mut db).await.expect("load transfer facts");
        assert_eq!(rows.len(), 2);
        let values: Vec<i64> = rows.iter().map(|row| row.get::<String, _>("quantity_delta").parse::<i64>().unwrap()).collect();
        assert_eq!(values.iter().sum::<i64>(), 0, "transfer must conserve base quantity");

        insert_document(&mut db, "a", "reverse-doc", "adjustment", "confirmed", Some("RV-0001")).await;
        sqlx::query("INSERT INTO inventory_stock_movement_compensations(movement_id,company_id,effect_document_id,source_line_id,original_movement_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES('comp-source','company-a','reverse-doc','transfer-line','move-source','product-a','warehouse-a','2026-09-11',1,'2026-09-11T12:00:00.000Z','3')")
            .execute(&mut db).await.expect("append compensation fact");
        let duplicate_compensation = sqlx::query("INSERT INTO inventory_stock_movement_compensations(movement_id,company_id,effect_document_id,source_line_id,original_movement_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES('comp-source-2','company-a','reverse-doc','transfer-line','move-source','product-a','warehouse-a','2026-09-11',2,'2026-09-11T12:00:00.000Z','3')")
            .execute(&mut db).await;
        assert!(duplicate_compensation.is_err(), "one immutable movement may be compensated only once");
        let unified_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_all_stock_movements WHERE document_id IN ('transfer-ok','reverse-doc')")
            .fetch_one(&mut db).await.expect("query unified movement ledger");
        assert_eq!(unified_count, 3, "unified ledger exposes two transfer facts plus one compensation");
    });
}

fn unique_database_path() -> PathBuf {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).expect("clock").as_nanos();
    std::env::temp_dir().join(format!("argin-phase20-{}-{nanos}.db", std::process::id()))
}

#[test]
fn idempotency_and_authoritative_movements_survive_database_restart() {
    run_async(async {
        let path = unique_database_path();
        let url = format!("sqlite://{}", path.display());
        {
            let mut db = SqliteConnection::connect(&format!("{url}?mode=rwc")).await.expect("create restart test database");
            sqlx::query("PRAGMA foreign_keys = ON").execute(&mut db).await.expect("enable foreign keys");
            apply_migrations(&mut db, 0, 27).await;
            seed_company_master_data(&mut db, "a").await;
            insert_document(&mut db, "a", "restart-doc", "receipt", "confirmed", Some("REC-R1")).await;
            insert_line(&mut db, "a", "restart-doc", "restart-line", 1).await;
            insert_movement(&mut db, "a", "restart-move", "restart-doc", "restart-line", None, "7.25", 1).await.expect("persist movement");
            sqlx::query("INSERT INTO inventory_idempotency(company_id,request_key,operation,payload_fingerprint,outcome_kind,document_id,document_version,document_status,recorded_at) VALUES('company-a','restart-request','confirm:restart-doc','fingerprint-1','confirmation','restart-doc',1,'confirmed','2026-09-10T12:01:00.000Z')")
                .execute(&mut db).await.expect("persist idempotency result");
            db.close().await.expect("close first connection");
        }
        {
            let mut reopened = SqliteConnection::connect(&url).await.expect("reopen persisted database");
            sqlx::query("PRAGMA foreign_keys = ON").execute(&mut reopened).await.expect("enable foreign keys after restart");
            let fingerprint: String = sqlx::query_scalar("SELECT payload_fingerprint FROM inventory_idempotency WHERE company_id='company-a' AND request_key='restart-request'")
                .fetch_one(&mut reopened).await.expect("idempotency survives restart");
            assert_eq!(fingerprint, "fingerprint-1");
            let movement_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_all_stock_movements WHERE movement_id='restart-move'")
                .fetch_one(&mut reopened).await.expect("movement survives restart");
            assert_eq!(movement_count, 1);
            let duplicate_request = sqlx::query("INSERT INTO inventory_idempotency(company_id,request_key,operation,payload_fingerprint,outcome_kind,document_id,document_version,document_status,recorded_at) VALUES('company-a','restart-request','confirm:restart-doc','changed','confirmation','restart-doc',1,'confirmed','2026-09-10T12:02:00.000Z')")
                .execute(&mut reopened).await;
            assert!(duplicate_request.is_err(), "same durable request key cannot be inserted twice after restart");
            reopened.close().await.expect("close reopened database");
        }
        let _ = std::fs::remove_file(path);
    });
}
