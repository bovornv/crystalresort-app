-- ============================================================================
-- Fix purchase_items table schema - Add missing columns
-- Run this in Supabase SQL Editor to add missing columns
-- ============================================================================

-- Add urgency column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'urgency'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN urgency TEXT DEFAULT 'normal';
        RAISE NOTICE 'Added urgency column to purchase_items table';
    ELSE
        RAISE NOTICE 'urgency column already exists in purchase_items table';
    END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added notes column to purchase_items table';
    ELSE
        RAISE NOTICE 'notes column already exists in purchase_items table';
    END IF;
END $$;

-- Add issue_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'issue_type'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN issue_type TEXT;
        RAISE NOTICE 'Added issue_type column to purchase_items table';
    ELSE
        RAISE NOTICE 'issue_type column already exists in purchase_items table';
    END IF;
END $$;

-- Add issue_reason column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'issue_reason'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN issue_reason TEXT;
        RAISE NOTICE 'Added issue_reason column to purchase_items table';
    ELSE
        RAISE NOTICE 'issue_reason column already exists in purchase_items table';
    END IF;
END $$;

-- Add requested_qty column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'requested_qty'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN requested_qty NUMERIC DEFAULT 0;
        -- Update existing rows to use quantity as requested_qty
        UPDATE purchase_items 
        SET requested_qty = quantity 
        WHERE requested_qty IS NULL;
        RAISE NOTICE 'Added requested_qty column to purchase_items table';
    ELSE
        RAISE NOTICE 'requested_qty column already exists in purchase_items table';
    END IF;
END $$;

-- Add received_qty column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'received_qty'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN received_qty NUMERIC DEFAULT 0;
        RAISE NOTICE 'Added received_qty column to purchase_items table';
    ELSE
        RAISE NOTICE 'received_qty column already exists in purchase_items table';
    END IF;
END $$;

-- Add created_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN created_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added created_by column to purchase_items table';
    ELSE
        RAISE NOTICE 'created_by column already exists in purchase_items table';
    END IF;
END $$;

-- Add updated_by column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN updated_by UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added updated_by column to purchase_items table';
    ELSE
        RAISE NOTICE 'updated_by column already exists in purchase_items table';
    END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        -- Update existing rows to have created_at
        UPDATE purchase_items 
        SET created_at = NOW() 
        WHERE created_at IS NULL;
        RAISE NOTICE 'Added created_at column to purchase_items table';
    ELSE
        RAISE NOTICE 'created_at column already exists in purchase_items table';
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_items' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE purchase_items 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        -- Update existing rows to have updated_at
        UPDATE purchase_items 
        SET updated_at = NOW() 
        WHERE updated_at IS NULL;
        RAISE NOTICE 'Added updated_at column to purchase_items table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in purchase_items table';
    END IF;
END $$;

-- Verify all columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_items' 
ORDER BY ordinal_position;
