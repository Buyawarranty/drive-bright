-- Enable realtime for sales_leads and abandoned_carts for multi-user sync
DO $$
BEGIN
  -- Remove first to avoid duplicate errors, then re-add
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE sales_leads;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE abandoned_carts;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE sales_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE abandoned_carts;