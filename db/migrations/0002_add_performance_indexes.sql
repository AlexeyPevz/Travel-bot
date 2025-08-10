-- Performance indexes for AI Travel Agent

-- Profiles indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_active ON profiles(is_active) WHERE is_active = true;
CREATE INDEX idx_profiles_vacation_type ON profiles(vacation_type);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- Tour priorities indexes
CREATE INDEX idx_tour_priorities_user_id ON tour_priorities(user_id);

-- Group profiles indexes
CREATE INDEX idx_group_profiles_chat_id ON group_profiles(chat_id);
CREATE INDEX idx_group_profiles_active ON group_profiles(is_active) WHERE is_active = true;

-- Tours indexes
CREATE INDEX idx_tours_provider ON tours(provider);
CREATE INDEX idx_tours_country ON tours(country);
CREATE INDEX idx_tours_price ON tours(price);
CREATE INDEX idx_tours_rating ON tours(star_rating);
CREATE INDEX idx_tours_created_at ON tours(created_at);
CREATE INDEX idx_tours_composite ON tours(country, star_rating, price);

-- Tour matches indexes
CREATE INDEX idx_tour_matches_user_id ON tour_matches(user_id);
CREATE INDEX idx_tour_matches_tour_id ON tour_matches(tour_id);
CREATE INDEX idx_tour_matches_score ON tour_matches(match_score);
CREATE INDEX idx_tour_matches_notified ON tour_matches(is_notified);
CREATE INDEX idx_tour_matches_composite ON tour_matches(user_id, is_notified, match_score);

-- Group tour votes indexes
CREATE INDEX idx_group_tour_votes_group_id ON group_tour_votes(group_id);
CREATE INDEX idx_group_tour_votes_tour_id ON group_tour_votes(tour_id);
CREATE INDEX idx_group_tour_votes_user_id ON group_tour_votes(user_id);

-- Monitoring tasks indexes
CREATE INDEX idx_monitoring_tasks_status ON monitoring_tasks(status);
CREATE INDEX idx_monitoring_tasks_next_run ON monitoring_tasks(next_run_at);
CREATE INDEX idx_monitoring_tasks_type ON monitoring_tasks(task_type);
CREATE INDEX idx_monitoring_tasks_composite ON monitoring_tasks(status, next_run_at) 
  WHERE status = 'active';

-- Sessions indexes (for JWT refresh tokens if stored)
CREATE INDEX idx_sessions_user_id ON sessions(user_id) WHERE sessions IS NOT NULL;
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) WHERE sessions IS NOT NULL;

-- Full text search indexes for tour search
CREATE INDEX idx_tours_hotel_name_gin ON tours USING gin(to_tsvector('russian', hotel_name));
CREATE INDEX idx_tours_region_gin ON tours USING gin(to_tsvector('russian', region));

-- Partial indexes for common queries
CREATE INDEX idx_tours_active_beach ON tours(country, star_rating, price) 
  WHERE meal_type IN ('ai', 'uai') AND star_rating >= 4;

CREATE INDEX idx_profiles_budget_range ON profiles(budget) 
  WHERE budget IS NOT NULL AND is_active = true;

-- BRIN indexes for time-series data
CREATE INDEX idx_tours_created_brin ON tours USING brin(created_at);
CREATE INDEX idx_tour_matches_created_brin ON tour_matches USING brin(created_at);