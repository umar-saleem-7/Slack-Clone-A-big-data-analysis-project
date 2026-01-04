-- Add notifications table to PostgreSQL
-- Run this script to add the notifications system

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'channel_invite', 'mention', 'message', etc.
    channel_id UUID REFERENCES channels(channel_id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Insert sample notification (optional - for testing)
-- INSERT INTO notifications (user_id, type, message) VALUES ('user-uuid-here', 'system', 'Welcome to Slack Clone!');
