CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    normalized_username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    must_change_password INTEGER NOT NULL DEFAULT 0,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT uq_users_normalized_username
        UNIQUE (normalized_username),

    CONSTRAINT ck_users_status
        CHECK (
            status IN (
                'active',
                'inactive',
                'locked'
            )
        ),

    CONSTRAINT ck_users_password_change
        CHECK (must_change_password IN (0, 1)),

    CONSTRAINT ck_users_failed_count
        CHECK (failed_login_count >= 0)
);

CREATE INDEX ix_users_status
ON users(status);

CREATE TABLE roles (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL,
    normalized_code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT uq_roles_normalized_code
        UNIQUE (normalized_code),

    CONSTRAINT ck_roles_system
        CHECK (is_system IN (0, 1)),

    CONSTRAINT ck_roles_active
        CHECK (is_active IN (0, 1))
);

CREATE TABLE permissions (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL,
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    CONSTRAINT uq_permissions_code
        UNIQUE (code),

    CONSTRAINT ck_permissions_active
        CHECK (is_active IN (0, 1))
);

CREATE INDEX ix_permissions_module
ON permissions(module);

CREATE TABLE user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    assigned_by TEXT,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX ix_user_roles_role
ON user_roles(role_id);

CREATE TABLE role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    assigned_by TEXT,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

CREATE INDEX ix_role_permissions_permission
ON role_permissions(permission_id);

CREATE TABLE user_branch_access (
    user_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    can_access INTEGER NOT NULL DEFAULT 1,
    assigned_at TEXT NOT NULL,
    assigned_by TEXT,

    PRIMARY KEY (user_id, branch_id),

    CONSTRAINT fk_user_branch_access_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_branch_access_branch
        FOREIGN KEY (branch_id)
        REFERENCES branches(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_branch_access_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_user_branch_access
        CHECK (can_access IN (0, 1))
);

CREATE INDEX ix_user_branch_access_branch
ON user_branch_access(branch_id);
