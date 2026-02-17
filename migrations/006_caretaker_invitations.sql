-- Migration: Caretaker invitations
-- Created: 2026-02-16
-- Description: Adds caretaker invitation flow for landlord-created caretakers

CREATE TABLE IF NOT EXISTS caretaker_invitations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  landlord_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  invitation_token VARCHAR UNIQUE,
  invitation_sent_at TIMESTAMP,
  invitation_accepted_at TIMESTAMP,
  status VARCHAR DEFAULT 'pending',
  expires_at TIMESTAMP,
  property_id VARCHAR REFERENCES properties(id) ON DELETE SET NULL,
  unit_id VARCHAR REFERENCES units(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretaker_invitations_landlord ON caretaker_invitations(landlord_id);
CREATE INDEX IF NOT EXISTS idx_caretaker_invitations_email ON caretaker_invitations(email);
CREATE INDEX IF NOT EXISTS idx_caretaker_invitations_status ON caretaker_invitations(status);
CREATE INDEX IF NOT EXISTS idx_caretaker_invitations_token ON caretaker_invitations(invitation_token);
