-- ============================================================================
-- Fix purchase_history table schema
-- Run this in Supabase SQL Editor to add missing created_at column
-- ============================================================================

-- Add created_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'purchase_history' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE purchase_history 
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Update existing rows to have created_at based on id (if id contains timestamp)
        -- Or set to current time if id doesn't contain timestamp
        UPDATE purchase_history 
        SET created_at = NOW() 
        WHERE created_at IS NULL;
        
        RAISE NOTICE 'Added created_at column to purchase_history table';
    ELSE
        RAISE NOTICE 'created_at column already exists in purchase_history table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'purchase_history' 
ORDER BY ordinal_position;
