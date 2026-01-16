-- Add nickname columns to purchase_items table to track who edited/created items
-- These columns store the nickname for easy display without needing to join users table

-- Add updated_by_nickname column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'updated_by_nickname') THEN
        ALTER TABLE purchase_items ADD COLUMN updated_by_nickname TEXT;
        RAISE NOTICE 'Added updated_by_nickname column to purchase_items table.';
    ELSE
        RAISE NOTICE 'updated_by_nickname column already exists in purchase_items table.';
    END IF;
END
$$;

-- Add created_by_nickname column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_items' AND column_name = 'created_by_nickname') THEN
        ALTER TABLE purchase_items ADD COLUMN created_by_nickname TEXT;
        RAISE NOTICE 'Added created_by_nickname column to purchase_items table.';
    ELSE
        RAISE NOTICE 'created_by_nickname column already exists in purchase_items table.';
    END IF;
END
$$;
