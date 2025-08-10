-- Change the products table category column from ENUM to text to match categories table
ALTER TABLE products ALTER COLUMN category TYPE text;