-- Migration: Initial schema
-- Created at: 2024-01-01

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  travel_style VARCHAR(50) NOT NULL CHECK (travel_style IN ('budget', 'comfort', 'luxury')),
  interests TEXT[] DEFAULT '{}',
  budget JSONB DEFAULT '{"min": 0, "max": 0}',
  preferences JSONB DEFAULT '{}',
  referral_code VARCHAR(50) UNIQUE,
  referred_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for profiles
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_referral_code ON profiles(referral_code);

-- Create travel_requests table
CREATE TABLE IF NOT EXISTS travel_requests (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  destination VARCHAR(255),
  start_date DATE,
  end_date DATE,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  budget JSONB DEFAULT '{"min": 0, "max": 0}',
  preferences JSONB DEFAULT '{}',
  analysis JSONB,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);

-- Create indexes for travel_requests
CREATE INDEX idx_travel_requests_user_id ON travel_requests(user_id);
CREATE INDEX idx_travel_requests_status ON travel_requests(status);
CREATE INDEX idx_travel_requests_created_at ON travel_requests(created_at);

-- Create tours table
CREATE TABLE IF NOT EXISTS tours (
  id VARCHAR(255) PRIMARY KEY,
  request_id VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  external_id VARCHAR(255),
  title TEXT NOT NULL,
  description TEXT,
  destination VARCHAR(255),
  hotel_name VARCHAR(255),
  hotel_rating DECIMAL(2,1),
  room_type VARCHAR(255),
  meal_type VARCHAR(255),
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'RUB',
  start_date DATE,
  end_date DATE,
  nights INTEGER,
  adults INTEGER,
  children INTEGER,
  includes TEXT[],
  images TEXT[],
  booking_url TEXT,
  match_score DECIMAL(3,2),
  analysis JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES travel_requests(id) ON DELETE CASCADE
);

-- Create indexes for tours
CREATE INDEX idx_tours_request_id ON tours(request_id);
CREATE INDEX idx_tours_price ON tours(price);
CREATE INDEX idx_tours_destination ON tours(destination);
CREATE INDEX idx_tours_match_score ON tours(match_score);

-- Create tour_cache table
CREATE TABLE IF NOT EXISTS tour_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  destination VARCHAR(255),
  search_params JSONB NOT NULL,
  results JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tour_cache
CREATE INDEX idx_tour_cache_key ON tour_cache(cache_key);
CREATE INDEX idx_tour_cache_expires ON tour_cache(expires_at);
CREATE INDEX idx_tour_cache_destination ON tour_cache(destination);

-- Create watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tour_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  initial_price DECIMAL(10,2),
  current_price DECIMAL(10,2),
  price_history JSONB DEFAULT '[]',
  notifications_sent INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES travel_requests(id) ON DELETE CASCADE,
  UNIQUE(user_id, tour_id)
);

-- Create indexes for watchlists
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_tour_id ON watchlists(tour_id);
CREATE INDEX idx_watchlists_active ON watchlists(is_active);

-- Create monitoring_tasks table
CREATE TABLE IF NOT EXISTS monitoring_tasks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  request_id VARCHAR(255) NOT NULL,
  interval INTEGER DEFAULT 3600,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES travel_requests(id) ON DELETE CASCADE,
  UNIQUE(user_id, request_id)
);

-- Create indexes for monitoring_tasks
CREATE INDEX idx_monitoring_tasks_user_id ON monitoring_tasks(user_id);
CREATE INDEX idx_monitoring_tasks_active ON monitoring_tasks(is_active);
CREATE INDEX idx_monitoring_tasks_next_run ON monitoring_tasks(next_run);

-- Create group_profiles table
CREATE TABLE IF NOT EXISTS group_profiles (
  id SERIAL PRIMARY KEY,
  chat_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  travel_style VARCHAR(50),
  interests TEXT[] DEFAULT '{}',
  budget JSONB DEFAULT '{"min": 0, "max": 0}',
  preferences JSONB DEFAULT '{}',
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for group_profiles
CREATE INDEX idx_group_profiles_chat_id ON group_profiles(chat_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_travel_requests_updated_at BEFORE UPDATE ON travel_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON watchlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_tasks_updated_at BEFORE UPDATE ON monitoring_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_profiles_updated_at BEFORE UPDATE ON group_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();