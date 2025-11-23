-- 1. Cleanup (voor development, pas op in productie!)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS household_members CASCADE;
DROP TABLE IF EXISTS households CASCADE;
DROP FUNCTION IF EXISTS is_household_member;

-- ==========================================
-- 2. Schema Setup (DDL)
-- ==========================================

-- Households: De 'Tenant'
CREATE TABLE households (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    owner_id UUID REFERENCES auth.users(id) NOT NULL
);

-- Members: Koppeling User <-> Household
CREATE TABLE household_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member', -- 'owner', 'member', 'viewer'
    is_accepted BOOLEAN DEFAULT false, -- Uitnodiging systeem
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Zorg dat een user maar 1x in een household zit
    UNIQUE(household_id, user_id)
);

-- Accounts: Bankrekeningen
CREATE TABLE accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    iban TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE, -- Null = Global default
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('INCOME', 'EXPENSE')),
    is_fixed BOOLEAN DEFAULT false,
    is_allowance BOOLEAN DEFAULT false
);

-- Transactions
CREATE TABLE transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL, -- Cruciaal voor RLS speed
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id),

    date DATE NOT NULL,
    amount_cents INTEGER NOT NULL, -- Altijd centen!
    description TEXT NOT NULL,
    counterparty_name TEXT,
    import_hash TEXT UNIQUE,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. Row Level Security (RLS) Functies
-- ==========================================

-- Enable RLS op alle tabellen
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Helper Functie: "Zit ik in dit huishouden?"
-- SECURITY DEFINER: Draait met admin rechten om household_members te mogen lezen
-- Dit voorkomt recursie problemen in policies.
CREATE OR REPLACE FUNCTION is_household_member(_household_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM household_members
    WHERE household_id = _household_id
    AND user_id = auth.uid()
    -- Optioneel: AND is_accepted = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. RLS Policies (De Regels)
-- ==========================================

-- --- HOUSEHOLDS ---
-- Je mag een household zien als je er lid van bent
CREATE POLICY "Members can view households" ON households
    FOR SELECT USING (is_household_member(id));

-- Je mag een household aanmaken (iedereen die ingelogd is)
CREATE POLICY "Users can create households" ON households
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- --- MEMBERS ---
-- Je mag leden zien van huishoudens waar jij OOK in zit
CREATE POLICY "Members can view other members" ON household_members
    FOR SELECT USING (
        is_household_member(household_id)
    );

-- Alleen leden toevoegen als je zelf lid bent (of specifieke admin logica)
CREATE POLICY "Members can add members" ON household_members
    FOR INSERT WITH CHECK (
        is_household_member(household_id)
    );

-- --- TRANSACTIONS (De belangrijkste!) ---
-- Select: Mag alleen als je bij het household hoort
CREATE POLICY "Access transactions of own household" ON transactions
    FOR ALL
    USING (is_household_member(household_id));

-- --- ACCOUNTS ---
CREATE POLICY "Access accounts of own household" ON accounts
    FOR ALL
    USING (is_household_member(household_id));

-- --- CATEGORIES ---
-- Categories zijn tricky: Je mag je eigen zien OF de globale (waar household_id IS NULL)
CREATE POLICY "Access own or global categories" ON categories
    FOR ALL
    USING (
        (household_id IS NULL) OR is_household_member(household_id)
    );

-- Indexes
CREATE INDEX idx_transactions_household ON transactions(household_id);
CREATE INDEX idx_members_user_household ON household_members(user_id, household_id);
