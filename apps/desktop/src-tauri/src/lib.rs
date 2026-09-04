// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod password_commands;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(target_os = "macos")]
fn configure_report_print_orientation() {
    use objc2_app_kit::{NSPaperOrientation, NSPrintInfo};

    let print_info = NSPrintInfo::sharedPrintInfo();
    print_info.setOrientation(NSPaperOrientation::Landscape);
}

#[cfg(not(target_os = "macos"))]
fn configure_report_print_orientation() {}

#[tauri::command]
fn print_current_webview(webview: tauri::WebviewWindow) -> Result<(), String> {
    configure_report_print_orientation();
    webview.print().map_err(|error| error.to_string())
}

use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:argin-accounting.db";

fn database_migrations() -> Vec<Migration> {
    vec![
        Migration { version: 1, description: "initialize_database", sql: include_str!("../migrations/0001_initialize_database.sql"), kind: MigrationKind::Up },
        Migration { version: 2, description: "company_and_branch", sql: include_str!("../migrations/0002_company_and_branch.sql"), kind: MigrationKind::Up },
        Migration { version: 3, description: "fiscal_management", sql: include_str!("../migrations/0003_fiscal_management.sql"), kind: MigrationKind::Up },
        Migration { version: 4, description: "security", sql: include_str!("../migrations/0004_security.sql"), kind: MigrationKind::Up },
        Migration { version: 5, description: "audit_approval", sql: include_str!("../migrations/0005_audit_and_approval.sql"), kind: MigrationKind::Up },
        Migration { version: 6, description: "approval_optimistic_concurrency", sql: include_str!("../migrations/0006_approval_optimistic_concurrency.sql"), kind: MigrationKind::Up },
        Migration { version: 7, description: "background_jobs", sql: include_str!("../migrations/0007_background_jobs.sql"), kind: MigrationKind::Up },
        Migration { version: 8, description: "notifications", sql: include_str!("../migrations/0008_notifications.sql"), kind: MigrationKind::Up },
        Migration { version: 9, description: "background_job_context", sql: include_str!("../migrations/0009_background_job_context.sql"), kind: MigrationKind::Up },
        Migration { version: 10, description: "chart_of_accounts", sql: include_str!("../migrations/0010_chart_of_accounts.sql"), kind: MigrationKind::Up },
        Migration { version: 11, description: "accounting_dimensions", sql: include_str!("../migrations/0011_accounting_dimensions.sql"), kind: MigrationKind::Up },
        Migration { version: 12, description: "coding_templates", sql: include_str!("../migrations/0012_coding_templates.sql"), kind: MigrationKind::Up },
        Migration { version: 13, description: "journal_vouchers", sql: include_str!("../migrations/0013_journal_vouchers.sql"), kind: MigrationKind::Up },
        Migration { version: 14, description: "journal_lifecycle", sql: include_str!("../migrations/0014_journal_lifecycle.sql"), kind: MigrationKind::Up },
        Migration { version: 15, description: "accounting_report_indexes", sql: include_str!("../migrations/0015_accounting_report_indexes.sql"), kind: MigrationKind::Up },
        Migration { version: 16, description: "parties", sql: include_str!("../migrations/0016_parties.sql"), kind: MigrationKind::Up },
        Migration { version: 17, description: "party_sync_metadata", sql: include_str!("../migrations/0017_party_sync_metadata.sql"), kind: MigrationKind::Up },
        Migration { version: 18, description: "taxpayer_unit_reference_data", sql: include_str!("../migrations/0018_taxpayer_unit_reference_data.sql"), kind: MigrationKind::Up },
        Migration { version: 19, description: "products_services", sql: include_str!("../migrations/0019_products_services.sql"), kind: MigrationKind::Up },
        Migration { version: 20, description: "product_sync_metadata", sql: include_str!("../migrations/0020_product_sync_metadata.sql"), kind: MigrationKind::Up },
        Migration { version: 21, description: "product_idempotency", sql: include_str!("../migrations/0021_product_idempotency.sql"), kind: MigrationKind::Up },
        Migration { version: 22, description: "warehouses", sql: include_str!("../migrations/0022_warehouses.sql"), kind: MigrationKind::Up },
        Migration { version: 23, description: "warehouse_sync_metadata", sql: include_str!("../migrations/0023_warehouse_sync_metadata.sql"), kind: MigrationKind::Up },
        Migration { version: 24, description: "warehouse_idempotency", sql: include_str!("../migrations/0024_warehouse_idempotency.sql"), kind: MigrationKind::Up },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            print_current_webview,
            password_commands::hash_password,
            password_commands::verify_password,
        ])
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, database_migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running ArginAccounting");
}
