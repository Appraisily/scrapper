-- PostgreSQL schema for Invaluable scraped data

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auctions (
    id              SERIAL PRIMARY KEY,
    auction_uid     UUID            DEFAULT gen_random_uuid(),
    source_auction  VARCHAR(64)     NOT NULL UNIQUE,
    title           TEXT            NOT NULL,
    sale_date       TIMESTAMPTZ     NOT NULL,
    source_file     TEXT,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lots (
    id              BIGSERIAL PRIMARY KEY,
    auction_id      INTEGER         NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    lot_uid         UUID            DEFAULT gen_random_uuid(),
    source_lot      VARCHAR(64)     NOT NULL,
    t               TEXT            NOT NULL,
    d               TEXT,
    eL              NUMERIC,
    eH              NUMERIC,
    hp              NUMERIC,
    currency        CHAR(3)         NOT NULL,
    img_key         TEXT            NOT NULL,
    tags            TEXT[],
    raw_json        JSONB,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE(auction_id, source_lot)
);

ALTER TABLE lots
    ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS
      (to_tsvector('simple', coalesce(t,'') || ' ' || coalesce(d,''))) STORED;

CREATE INDEX IF NOT EXISTS idx_lots_fts ON lots USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_lots_auction_id ON lots(auction_id);

CREATE TABLE IF NOT EXISTS images (
    id          SERIAL PRIMARY KEY,
    lot_id      BIGINT NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    gcs_key     TEXT   NOT NULL,
    width       INTEGER,
    height      INTEGER,
    position    SMALLINT,
    UNIQUE(lot_id, gcs_key)
);