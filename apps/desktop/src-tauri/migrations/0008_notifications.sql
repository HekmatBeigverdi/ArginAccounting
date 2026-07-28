CREATE TABLE notifications (
    notification_id     TEXT PRIMARY KEY NOT NULL,
    notification_type   TEXT NOT NULL,
    recipient_type      TEXT NOT NULL
                        CHECK (
                            recipient_type IN (
                                'user',
                                'role',
                                'branch',
                                'company',
                                'system'
                            )
                        ),
    recipient_id        TEXT NOT NULL,
    title               TEXT NOT NULL,
    message             TEXT NOT NULL,
    severity            TEXT NOT NULL
                        CHECK (
                            severity IN (
                                'information',
                                'success',
                                'warning',
                                'error'
                            )
                        ),
    channels_json       TEXT NOT NULL
                        CHECK (json_valid(channels_json)),
    actions_json        TEXT NOT NULL
                        CHECK (json_valid(actions_json)),
    data_json           TEXT
                        CHECK (
                            data_json IS NULL
                            OR json_valid(data_json)
                        ),
    created_at          TEXT NOT NULL,
    read_at             TEXT,
    expires_at          TEXT,
    correlation_id      TEXT,
    source_module       TEXT
);

CREATE INDEX idx_notifications_recipient_created
ON notifications(
    recipient_type,
    recipient_id,
    created_at DESC
);

CREATE INDEX idx_notifications_recipient_unread
ON notifications(
    recipient_type,
    recipient_id,
    read_at
);

CREATE INDEX idx_notifications_expires
ON notifications(expires_at);
