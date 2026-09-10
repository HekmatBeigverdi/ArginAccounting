use sqlx::{Connection, Row, SqliteConnection};

const REQUIRED_MIGRATIONS: [&str; 7] = [
    include_str!("../migrations/0002_company_and_branch.sql"),
    include_str!("../migrations/0003_fiscal_management.sql"),
    include_str!("../migrations/0018_taxpayer_unit_reference_data.sql"),
    include_str!("../migrations/0019_products_services.sql"),
    include_str!("../migrations/0022_warehouses.sql"),
    include_str!("../migrations/0026_inventory_documents.sql"),
    include_str!("../migrations/0027_inventory_reversal_persistence.sql"),
];

fn run_async<T>(future: impl std::future::Future<Output = T>) -> T {
    tauri::async_runtime::block_on(future)
}

async fn database() -> SqliteConnection {
    let mut db = SqliteConnection::connect("sqlite::memory:").await.expect("open SQLite");
    sqlx::query("PRAGMA foreign_keys = ON").execute(&mut db).await.expect("enable foreign keys");
    for migration in REQUIRED_MIGRATIONS {
        sqlx::raw_sql(migration).execute(&mut db).await.expect("apply required migration");
    }
    let now = "2026-09-10T12:00:00.000Z";
    sqlx::query("INSERT INTO companies(id,code,legal_name,base_currency,locale,calendar,status,created_at,updated_at) VALUES('company-1','C1','Company','IRR','fa-IR','jalali','active',?,?)")
        .bind(now).bind(now).execute(&mut db).await.unwrap();
    sqlx::query("INSERT INTO branches(id,company_id,code,name,is_head_office,status,created_at,updated_at) VALUES('branch-1','company-1','B1','Branch',1,'active',?,?)")
        .bind(now).bind(now).execute(&mut db).await.unwrap();
    sqlx::query("INSERT INTO fiscal_years(id,company_id,code,title,start_date,end_date,status,is_current,created_at,updated_at) VALUES('fy-1','company-1','Y1','Year','2026-01-01','2026-12-31','open',1,?,?)")
        .bind(now).bind(now).execute(&mut db).await.unwrap();
    sqlx::query("INSERT INTO fiscal_periods(id,fiscal_year_id,sequence,code,title,start_date,end_date,status,created_at,updated_at) VALUES('fp-1','fy-1',1,'P1','Period','2026-01-01','2026-12-31','open',?,?)")
        .bind(now).bind(now).execute(&mut db).await.unwrap();
    sqlx::query("INSERT INTO products(id,company_id,code,title,kind,status,purchasable,sellable,created_at,updated_at,version) VALUES('product-1','company-1','P1','Product','product','active',1,1,?,?,1)")
        .bind(now).bind(now).execute(&mut db).await.unwrap();
    sqlx::query("INSERT INTO warehouses(id,company_id,code,title,kind,status,organizational_scope,branch_id,created_at,updated_at,version) VALUES('warehouse-1','company-1','W1','Warehouse','general','active','branch','branch-1',?,?,1)")
        .bind(now).bind(now).execute(&mut db).await.unwrap();
    db
}

async fn add_fact(db: &mut SqliteConnection, document_id: &str, line_id: &str, movement_id: &str, delta: &str, order: i64) {
    let now = "2026-09-10T12:00:00.000Z";
    sqlx::query("INSERT INTO inventory_documents(id,company_id,document_type,status,document_number,business_date,origin_branch_id,fiscal_year_id,fiscal_period_id,version,created_at,updated_at) VALUES(?,'company-1','adjustment','confirmed',NULL,'2026-09-10','branch-1','fy-1','fp-1',1,?,?)")
        .bind(document_id).bind(now).bind(now).execute(&mut *db).await.unwrap();
    sqlx::query("INSERT INTO inventory_document_lines(id,company_id,document_id,position,product_id,entered_quantity,base_quantity,entered_unit_id,base_unit_id,quantity_snapshot,warehouse_id) VALUES(?,'company-1',?,1,'product-1',?,?,'EA','EA','{}','warehouse-1')")
        .bind(line_id).bind(document_id).bind(delta).bind(delta).execute(&mut *db).await.unwrap();
    sqlx::query("INSERT INTO inventory_stock_movements(movement_id,company_id,document_id,line_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) VALUES(?,'company-1',?,?,'product-1','warehouse-1','2026-09-10',?,'2026-09-10T12:01:00.000Z',?)")
        .bind(movement_id).bind(document_id).bind(line_id).bind(order).bind(delta).execute(&mut *db).await.unwrap();
}

#[test]
fn rebuildable_balance_projection_can_be_recreated_from_authoritative_movement_facts() {
    run_async(async {
        let mut db = database().await;
        add_fact(&mut db, "doc-in", "line-in", "move-in", "10", 1).await;
        add_fact(&mut db, "doc-out", "line-out", "move-out", "-3", 2).await;

        let stock_key = "[\"company-1\",\"product-1\",\"warehouse-1\",null,null]";
        sqlx::query("INSERT INTO inventory_stock_balances(stock_key,company_id,product_id,warehouse_id,zone_id,location_id,quantity,last_business_date,last_business_order,last_movement_id,rebuilt_at) VALUES(?,'company-1','product-1','warehouse-1',NULL,NULL,'999','2026-09-10',2,'move-out','2026-09-10T12:02:00.000Z')")
            .bind(stock_key).execute(&mut db).await.expect("seed deliberately stale projection");

        sqlx::query("BEGIN IMMEDIATE").execute(&mut db).await.unwrap();
        sqlx::query("DELETE FROM inventory_stock_balances WHERE company_id='company-1'").execute(&mut db).await.unwrap();
        let facts = sqlx::query("SELECT quantity_delta,movement_id,business_date,business_order FROM inventory_all_stock_movements WHERE company_id='company-1' AND product_id='product-1' AND warehouse_id='warehouse-1' AND zone_id IS NULL AND location_id IS NULL ORDER BY business_date,business_order,document_id,line_id,movement_id")
            .fetch_all(&mut db).await.unwrap();
        let mut quantity: i64 = 0;
        for row in &facts {
            quantity += row.get::<String, _>("quantity_delta").parse::<i64>().unwrap();
        }
        let last = facts.last().expect("at least one movement");
        sqlx::query("INSERT INTO inventory_stock_balances(stock_key,company_id,product_id,warehouse_id,zone_id,location_id,quantity,last_business_date,last_business_order,last_movement_id,rebuilt_at) VALUES(?,'company-1','product-1','warehouse-1',NULL,NULL,?,?,?,?, '2026-09-10T12:03:00.000Z')")
            .bind(stock_key)
            .bind(quantity.to_string())
            .bind(last.get::<String, _>("business_date"))
            .bind(last.get::<i64, _>("business_order"))
            .bind(last.get::<String, _>("movement_id"))
            .execute(&mut db).await.unwrap();
        sqlx::query("COMMIT").execute(&mut db).await.unwrap();

        let rebuilt: String = sqlx::query_scalar("SELECT quantity FROM inventory_stock_balances WHERE stock_key=?")
            .bind(stock_key).fetch_one(&mut db).await.unwrap();
        assert_eq!(rebuilt, "7");
        let authoritative_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_all_stock_movements WHERE company_id='company-1'")
            .fetch_one(&mut db).await.unwrap();
        assert_eq!(authoritative_count, 2, "rebuilding the projection must not rewrite movement history");
    });
}
