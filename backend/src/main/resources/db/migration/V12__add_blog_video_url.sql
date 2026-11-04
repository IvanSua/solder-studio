-- Add video_url column to blog_posts for embedding YouTube or direct video links
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS video_url VARCHAR(2048);
