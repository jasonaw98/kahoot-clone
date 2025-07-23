-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_question INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, name)
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  time_limit INTEGER DEFAULT 30,
  order_index INTEGER NOT NULL
);

-- Create answers table for tracking responses
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer INTEGER NOT NULL,
  response_time INTEGER NOT NULL, -- milliseconds
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust based on your auth needs)
CREATE POLICY "Games are viewable by everyone" ON games FOR SELECT USING (true);
CREATE POLICY "Games can be created by everyone" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Games can be updated by everyone" ON games FOR UPDATE USING (true);

CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
CREATE POLICY "Players can be created by everyone" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can be updated by everyone" ON players FOR UPDATE USING (true);

CREATE POLICY "Questions are viewable by everyone" ON questions FOR SELECT USING (true);
CREATE POLICY "Questions can be created by everyone" ON questions FOR INSERT WITH CHECK (true);

CREATE POLICY "Answers are viewable by everyone" ON answers FOR SELECT USING (true);
CREATE POLICY "Answers can be created by everyone" ON answers FOR INSERT WITH CHECK (true);
