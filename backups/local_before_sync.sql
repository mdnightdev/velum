--
-- PostgreSQL database dump
--

\restrict nphcvmEkGWoDvg6vohiS0KPfEsR6Gs9d8707GMvY5FCCj5YBPlwUtrJvLcm7Bm2

-- Dumped from database version 18.4 (be2730e)
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO neondb_owner;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO neondb_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: neondb_owner
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: neondb_owner
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO neondb_owner;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: neondb_owner
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO neondb_owner;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: neondb_owner
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    log_id character varying(64) NOT NULL,
    admin_id integer NOT NULL,
    admin_name character varying(64) NOT NULL,
    action character varying(128) NOT NULL,
    target_id character varying(128),
    reason text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO neondb_owner;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO neondb_owner;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cards; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.cards (
    id integer NOT NULL,
    user_id integer NOT NULL,
    card_token character varying(32) NOT NULL,
    card_type character varying(16) DEFAULT 'CREDIT'::character varying NOT NULL,
    limit_cents integer DEFAULT 500000 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cards OWNER TO neondb_owner;

--
-- Name: cards_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cards_id_seq OWNER TO neondb_owner;

--
-- Name: cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.cards_id_seq OWNED BY public.cards.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    device_id character varying(64) NOT NULL,
    device_fingerprint character varying(64) NOT NULL,
    user_agent text,
    platform character varying(32),
    screen_resolution character varying(32),
    timezone character varying(64),
    language character varying(16),
    hardware_concurrency integer,
    device_memory integer,
    webgl_vendor character varying(128),
    webgl_renderer character varying(128),
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    access_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.devices OWNER TO neondb_owner;

--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devices_id_seq OWNER TO neondb_owner;

--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: escrows; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.escrows (
    id integer NOT NULL,
    listing_id integer NOT NULL,
    buyer_id integer NOT NULL,
    seller_id integer NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(16) DEFAULT 'HELD'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.escrows OWNER TO neondb_owner;

--
-- Name: escrows_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.escrows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.escrows_id_seq OWNER TO neondb_owner;

--
-- Name: escrows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.escrows_id_seq OWNED BY public.escrows.id;


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exchange_rates (
    id integer NOT NULL,
    base_currency character varying(8) NOT NULL,
    quote_currency character varying(8) NOT NULL,
    rate numeric(18,6) NOT NULL,
    effective_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exchange_rates OWNER TO neondb_owner;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.exchange_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exchange_rates_id_seq OWNER TO neondb_owner;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.exchange_rates_id_seq OWNED BY public.exchange_rates.id;


--
-- Name: ip_addresses; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.ip_addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ip_address character varying(45) NOT NULL,
    device_id character varying(64),
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    access_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.ip_addresses OWNER TO neondb_owner;

--
-- Name: ip_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.ip_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ip_addresses_id_seq OWNER TO neondb_owner;

--
-- Name: ip_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.ip_addresses_id_seq OWNED BY public.ip_addresses.id;


--
-- Name: listings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.listings (
    id integer NOT NULL,
    seller_id integer NOT NULL,
    title character varying(128) NOT NULL,
    description text NOT NULL,
    price numeric(18,2) NOT NULL,
    category character varying(64) NOT NULL,
    stock integer DEFAULT 1 NOT NULL,
    digital_delivery boolean DEFAULT false NOT NULL,
    digital_payload text,
    status character varying(16) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.listings OWNER TO neondb_owner;

--
-- Name: listings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.listings_id_seq OWNER TO neondb_owner;

--
-- Name: listings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.listings_id_seq OWNED BY public.listings.id;


--
-- Name: lounge_members; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lounge_members (
    id integer NOT NULL,
    lounge_id integer NOT NULL,
    user_id integer NOT NULL,
    role character varying(32) DEFAULT 'member'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lounge_members OWNER TO neondb_owner;

--
-- Name: lounge_members_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lounge_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lounge_members_id_seq OWNER TO neondb_owner;

--
-- Name: lounge_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lounge_members_id_seq OWNED BY public.lounge_members.id;


--
-- Name: lounges; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lounges (
    id integer NOT NULL,
    slug character varying(64),
    name character varying(64) NOT NULL,
    description text,
    owner_id integer,
    parent_lounge_id integer,
    is_official boolean DEFAULT false NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    invite_code character varying(64),
    access_level character varying(32) DEFAULT 'ALL'::character varying NOT NULL,
    type character varying(32) DEFAULT 'user_created'::character varying NOT NULL,
    last_message_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    avatar_url character varying(512),
    last_message_text text,
    last_message_sender_id integer,
    guidelines text
);


ALTER TABLE public.lounges OWNER TO neondb_owner;

--
-- Name: lounges_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lounges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lounges_id_seq OWNER TO neondb_owner;

--
-- Name: lounges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lounges_id_seq OWNED BY public.lounges.id;


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.message_reactions (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji character varying(32) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_reactions OWNER TO neondb_owner;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.message_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_reactions_id_seq OWNER TO neondb_owner;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.message_reactions_id_seq OWNED BY public.message_reactions.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    lounge_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text NOT NULL,
    encrypted boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    delivered_to text DEFAULT ''::text,
    read_by text DEFAULT ''::text,
    is_edited boolean DEFAULT false NOT NULL,
    edited_at timestamp without time zone,
    is_pinned boolean DEFAULT false NOT NULL,
    reply_to integer
);


ALTER TABLE public.messages OWNER TO neondb_owner;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO neondb_owner;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.outbox_events (
    id integer NOT NULL,
    event_type character varying(64) NOT NULL,
    aggregate_id character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.outbox_events OWNER TO neondb_owner;

--
-- Name: outbox_events_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.outbox_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.outbox_events_id_seq OWNER TO neondb_owner;

--
-- Name: outbox_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.outbox_events_id_seq OWNED BY public.outbox_events.id;


--
-- Name: relationships; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.relationships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    friend_id integer NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.relationships OWNER TO neondb_owner;

--
-- Name: relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.relationships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.relationships_id_seq OWNER TO neondb_owner;

--
-- Name: relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.relationships_id_seq OWNED BY public.relationships.id;


--
-- Name: reserves; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reserves (
    id integer NOT NULL,
    reserve_type character varying(32) NOT NULL,
    balance_cents integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reserves OWNER TO neondb_owner;

--
-- Name: reserves_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.reserves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reserves_id_seq OWNER TO neondb_owner;

--
-- Name: reserves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.reserves_id_seq OWNED BY public.reserves.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(64) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sessions OWNER TO neondb_owner;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO neondb_owner;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: support_admin_nominations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.support_admin_nominations (
    id integer NOT NULL,
    nominated_user_id integer NOT NULL,
    nominated_by integer NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    admin_account_id integer,
    credentials text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.support_admin_nominations OWNER TO neondb_owner;

--
-- Name: support_admin_nominations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.support_admin_nominations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_admin_nominations_id_seq OWNER TO neondb_owner;

--
-- Name: support_admin_nominations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.support_admin_nominations_id_seq OWNED BY public.support_admin_nominations.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subject character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(32) DEFAULT 'OPEN'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tickets OWNER TO neondb_owner;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO neondb_owner;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    reference character varying(32) NOT NULL,
    wallet_id integer NOT NULL,
    type character varying(16) NOT NULL,
    amount numeric(18,2) NOT NULL,
    status character varying(16) DEFAULT 'COMPLETED'::character varying NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO neondb_owner;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO neondb_owner;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_devices (
    id integer NOT NULL,
    user_id integer NOT NULL,
    device_id character varying(64) NOT NULL,
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT true NOT NULL
);


ALTER TABLE public.user_devices OWNER TO neondb_owner;

--
-- Name: user_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_devices_id_seq OWNER TO neondb_owner;

--
-- Name: user_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_devices_id_seq OWNED BY public.user_devices.id;


--
-- Name: user_prekeys; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_prekeys (
    id integer NOT NULL,
    user_id integer NOT NULL,
    identity_key text NOT NULL,
    signed_prekey text NOT NULL,
    signed_prekey_signature text NOT NULL,
    one_time_prekeys text DEFAULT '[]'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_prekeys OWNER TO neondb_owner;

--
-- Name: user_prekeys_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_prekeys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_prekeys_id_seq OWNER TO neondb_owner;

--
-- Name: user_prekeys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_prekeys_id_seq OWNED BY public.user_prekeys.id;


--
-- Name: user_unread_counts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_unread_counts (
    user_id integer NOT NULL,
    lounge_id integer NOT NULL,
    unread_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_unread_counts OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(32) NOT NULL,
    password_hash text NOT NULL,
    salt text NOT NULL,
    passcode_hash text,
    panic_phrase_hash text,
    recovery_key_hash text,
    login_recovery_key_hash text,
    duress_active boolean DEFAULT false NOT NULL,
    is_compromised boolean DEFAULT false NOT NULL,
    compromise_ticket_id character varying(32),
    role character varying(32) DEFAULT 'USER'::character varying NOT NULL,
    display_name character varying(64),
    avatar_url text,
    bio text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    location text,
    recovery_key text,
    recovery_key_delivered boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    balance numeric(18,2) DEFAULT 0.00 NOT NULL,
    currency character varying(8) DEFAULT 'USD'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wallets OWNER TO neondb_owner;

--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallets_id_seq OWNER TO neondb_owner;

--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: neondb_owner
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cards id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cards ALTER COLUMN id SET DEFAULT nextval('public.cards_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: escrows id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.escrows ALTER COLUMN id SET DEFAULT nextval('public.escrows_id_seq'::regclass);


--
-- Name: exchange_rates id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exchange_rates ALTER COLUMN id SET DEFAULT nextval('public.exchange_rates_id_seq'::regclass);


--
-- Name: ip_addresses id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ip_addresses ALTER COLUMN id SET DEFAULT nextval('public.ip_addresses_id_seq'::regclass);


--
-- Name: listings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.listings ALTER COLUMN id SET DEFAULT nextval('public.listings_id_seq'::regclass);


--
-- Name: lounge_members id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounge_members ALTER COLUMN id SET DEFAULT nextval('public.lounge_members_id_seq'::regclass);


--
-- Name: lounges id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounges ALTER COLUMN id SET DEFAULT nextval('public.lounges_id_seq'::regclass);


--
-- Name: message_reactions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.message_reactions ALTER COLUMN id SET DEFAULT nextval('public.message_reactions_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: outbox_events id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.outbox_events ALTER COLUMN id SET DEFAULT nextval('public.outbox_events_id_seq'::regclass);


--
-- Name: relationships id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.relationships ALTER COLUMN id SET DEFAULT nextval('public.relationships_id_seq'::regclass);


--
-- Name: reserves id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reserves ALTER COLUMN id SET DEFAULT nextval('public.reserves_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: support_admin_nominations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.support_admin_nominations ALTER COLUMN id SET DEFAULT nextval('public.support_admin_nominations_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_devices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_devices ALTER COLUMN id SET DEFAULT nextval('public.user_devices_id_seq'::regclass);


--
-- Name: user_prekeys id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_prekeys ALTER COLUMN id SET DEFAULT nextval('public.user_prekeys_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: neondb_owner
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.audit_logs (id, log_id, admin_id, admin_name, action, target_id, reason, "timestamp") FROM stdin;
1	al_cfe1bb68_audit	1	cli_admin	/db/wipe	N/A	test wipe	2026-07-29 12:44:30.892798
2	al_afdb00a8_audit	1	cli_admin	/bank/fundc	1000000000	TEST FUNDING	2026-07-29 12:59:19.884631
3	al_92007663_audit	1	cli_admin	/bank/fundc	CLEARING	Injected 1000000000 cents (Administrative Fund Inject)	2026-07-29 12:59:19.935094
4	al_2dabecdb_audit	1	cli_admin	/bank/fundt	10000000	TEST FUNDING	2026-07-29 13:00:15.050473
5	al_8f349637_audit	1	cli_admin	/bank/fundt	TREASURY	Injected 10000000 cents (Administrative Fund Inject)	2026-07-29 13:00:15.066955
6	al_2d8876b4_audit	1	cli_admin	/bank/funde	10000000	TEST FUNDING	2026-07-29 13:00:40.294863
7	al_f8132933_audit	1	cli_admin	/bank/funde	ESCROW	Injected 10000000 cents (Administrative Fund Inject)	2026-07-29 13:00:40.320164
35	al_d87db644_audit	1	cli_admin	/audits/ip	SYSTEM	Scanned IP subnet correlations	2026-07-29 13:27:37.512005
36	al_e85f67fc_audit	1	cli_admin	/audits/ledger	SYSTEM	Verified 10 transaction HMAC chains	2026-07-29 13:29:21.754108
37	al_92a93f68_audit	1	cli_admin	/audits/hijacks	SYSTEM	Scanned 11 active sessions	2026-07-29 13:29:34.336418
38	al_32d53199_audit	1	cli_admin	/audits/nodes	SYSTEM	Scanned 11 lounges, found 0 issues	2026-07-29 13:29:40.681049
39	al_ecfa71ae_audit	1	cli_admin	/sys/ccache	N/A	CLI V2 Administrative Action	2026-07-29 13:36:45.962732
40	al_8cccd9dd_audit	1	cli_admin	/escrow/list	N/A	CLI V2 Administrative Action	2026-07-29 13:37:52.519872
72	al_6bd2c994_audit	1	cli_admin	/escrow/list	N/A	CLI V2 Administrative Action	2026-07-29 14:00:41.910579
73	al_63fde442_audit	1	cli_admin	/db/redis	KEYS*	CLI V2 Administrative Override	2026-07-29 15:25:47.936822
74	al_3f7be34d_audit	1	cli_admin	/db/redis	KEYS*	Redis command: KEYS*	2026-07-29 15:25:48.254288
75	al_1efaa255_audit	1	cli_admin	/db/redis	N/A	CLI V2 Administrative Override	2026-07-29 15:26:15.950716
76	al_9474220e_audit	1	cli_admin	/db/redis	info	CLI V2 Administrative Override	2026-07-29 15:26:26.940336
77	al_0e6d9448_audit	1	cli_admin	/db/redis	info	Redis command: info	2026-07-29 15:26:27.028463
78	al_cce9d8af_audit	1	cli_admin	/db/redis	keys	CLI V2 Administrative Override	2026-07-29 15:26:55.276797
79	al_784d42ee_audit	1	cli_admin	/db/redis	keys	Redis command: keys	2026-07-29 15:26:55.320064
80	al_3aaabbaa_audit	1	cli_admin	/db/redis	get	CLI V2 Administrative Override	2026-07-29 15:27:14.050631
81	al_94000f27_audit	1	cli_admin	/db/pg	N/A	Curiosity	2026-07-29 15:29:48.795035
82	al_3d79e320_audit	1	cli_admin	/db/pg	tables	VERY CURIOUS	2026-07-29 15:30:15.797563
83	al_2268501e_audit	1	cli_admin	/audits/ledger	SYSTEM	Verified 84 transaction HMAC chains	2026-07-30 02:00:02.229893
84	al_3cee0cb6_audit	1	cli_admin	/audits/ip	SYSTEM	Scanned IP subnet correlations	2026-07-30 02:00:32.86862
85	al_29ba230f_audit	1	cli_admin	/users/create	N/A	CLI V2 Administrative Override	2026-07-30 16:33:20.624485
86	al_a0637d2a_audit	1	cli_admin	/users/create	Seoul Falafax@12 Bot	CLI V2 Administrative Override	2026-07-30 16:33:53.756398
87	al_8b1b7baa_audit	1	cli_admin	/db/backup	N/A	CLI V2 Administrative Override	2026-07-31 12:15:14.280306
88	al_5d267691_audit	1	cli_admin	/db/backup	velum_backup_1785489314299.json	Exported system configuration	2026-07-31 12:15:14.308966
89	al_c46ffdac_audit	1	cli_admin	/users/approve	618	CLI V2 Administrative Override	2026-08-05 22:32:19.780015
90	al_c66f88cf_audit	1	cli_admin	/users/approve	1	CLI V2 Administrative Override	2026-08-05 22:32:54.658827
91	al_b029f78a_audit	1	cli_admin	/users/approve	1	Approved support admin nomination	2026-08-05 22:32:55.063528
\.


--
-- Data for Name: cards; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.cards (id, user_id, card_token, card_type, limit_cents, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.devices (id, device_id, device_fingerprint, user_agent, platform, screen_resolution, timezone, language, hardware_concurrency, device_memory, webgl_vendor, webgl_renderer, first_seen, last_seen, access_count) FROM stdin;
\.


--
-- Data for Name: escrows; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.escrows (id, listing_id, buyer_id, seller_id, amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.exchange_rates (id, base_currency, quote_currency, rate, effective_at) FROM stdin;
1	VLM	TWD	42.903226	2026-07-30 10:45:06.992447
2	VLM	USD	1.330000	2026-07-30 10:45:06.992447
3	VLM	EUR	1.231481	2026-07-30 10:45:06.992447
4	VLM	GBP	1.039063	2026-07-30 10:45:06.992447
5	VLM	JPY	214.516129	2026-07-30 10:45:06.992447
6	VLM	CAD	1.821918	2026-07-30 10:45:06.992447
7	VLM	AUD	2.015152	2026-07-30 10:45:06.992447
8	VLM	CHF	1.198198	2026-07-30 10:45:06.992447
9	VLM	CNY	9.500000	2026-07-30 10:45:06.992447
10	VLM	SGD	1.797297	2026-07-30 10:45:06.992447
11	VLM	HKD	10.230769	2026-07-30 10:45:06.992447
12	TWD	VLM	0.023308	2026-07-30 10:45:06.992447
13	TWD	USD	0.031000	2026-07-30 10:45:06.992447
14	TWD	EUR	0.028704	2026-07-30 10:45:06.992447
15	TWD	GBP	0.024219	2026-07-30 10:45:06.992447
16	TWD	JPY	5.000000	2026-07-30 10:45:06.992447
17	TWD	CAD	0.042466	2026-07-30 10:45:06.992447
18	TWD	AUD	0.046970	2026-07-30 10:45:06.992447
19	TWD	CHF	0.027928	2026-07-30 10:45:06.992447
20	TWD	CNY	0.221429	2026-07-30 10:45:06.992447
21	TWD	SGD	0.041892	2026-07-30 10:45:06.992447
22	TWD	HKD	0.238462	2026-07-30 10:45:06.992447
23	USD	VLM	0.751880	2026-07-30 10:45:06.992447
24	USD	TWD	32.258065	2026-07-30 10:45:06.992447
25	USD	EUR	0.925926	2026-07-30 10:45:06.992447
26	USD	GBP	0.781250	2026-07-30 10:45:06.992447
27	USD	JPY	161.290323	2026-07-30 10:45:06.992447
28	USD	CAD	1.369863	2026-07-30 10:45:06.992447
29	USD	AUD	1.515152	2026-07-30 10:45:06.992447
30	USD	CHF	0.900901	2026-07-30 10:45:06.992447
31	USD	CNY	7.142857	2026-07-30 10:45:06.992447
32	USD	SGD	1.351351	2026-07-30 10:45:06.992447
33	USD	HKD	7.692308	2026-07-30 10:45:06.992447
34	EUR	VLM	0.812030	2026-07-30 10:45:06.992447
35	EUR	TWD	34.838710	2026-07-30 10:45:06.992447
36	EUR	USD	1.080000	2026-07-30 10:45:06.992447
37	EUR	GBP	0.843750	2026-07-30 10:45:06.992447
38	EUR	JPY	174.193548	2026-07-30 10:45:06.992447
39	EUR	CAD	1.479452	2026-07-30 10:45:06.992447
40	EUR	AUD	1.636364	2026-07-30 10:45:06.992447
41	EUR	CHF	0.972973	2026-07-30 10:45:06.992447
42	EUR	CNY	7.714286	2026-07-30 10:45:06.992447
43	EUR	SGD	1.459459	2026-07-30 10:45:06.992447
44	EUR	HKD	8.307692	2026-07-30 10:45:06.992447
45	GBP	VLM	0.962406	2026-07-30 10:45:06.992447
46	GBP	TWD	41.290323	2026-07-30 10:45:06.992447
47	GBP	USD	1.280000	2026-07-30 10:45:06.992447
48	GBP	EUR	1.185185	2026-07-30 10:45:06.992447
49	GBP	JPY	206.451613	2026-07-30 10:45:06.992447
50	GBP	CAD	1.753425	2026-07-30 10:45:06.992447
51	GBP	AUD	1.939394	2026-07-30 10:45:06.992447
52	GBP	CHF	1.153153	2026-07-30 10:45:06.992447
53	GBP	CNY	9.142857	2026-07-30 10:45:06.992447
54	GBP	SGD	1.729730	2026-07-30 10:45:06.992447
55	GBP	HKD	9.846154	2026-07-30 10:45:06.992447
56	JPY	VLM	0.004662	2026-07-30 10:45:06.992447
57	JPY	TWD	0.200000	2026-07-30 10:45:06.992447
58	JPY	USD	0.006200	2026-07-30 10:45:06.992447
59	JPY	EUR	0.005741	2026-07-30 10:45:06.992447
60	JPY	GBP	0.004844	2026-07-30 10:45:06.992447
61	JPY	CAD	0.008493	2026-07-30 10:45:06.992447
62	JPY	AUD	0.009394	2026-07-30 10:45:06.992447
63	JPY	CHF	0.005586	2026-07-30 10:45:06.992447
64	JPY	CNY	0.044286	2026-07-30 10:45:06.992447
65	JPY	SGD	0.008378	2026-07-30 10:45:06.992447
66	JPY	HKD	0.047692	2026-07-30 10:45:06.992447
67	CAD	VLM	0.548872	2026-07-30 10:45:06.992447
68	CAD	TWD	23.548387	2026-07-30 10:45:06.992447
69	CAD	USD	0.730000	2026-07-30 10:45:06.992447
70	CAD	EUR	0.675926	2026-07-30 10:45:06.992447
71	CAD	GBP	0.570313	2026-07-30 10:45:06.992447
72	CAD	JPY	117.741935	2026-07-30 10:45:06.992447
73	CAD	AUD	1.106061	2026-07-30 10:45:06.992447
74	CAD	CHF	0.657658	2026-07-30 10:45:06.992447
75	CAD	CNY	5.214286	2026-07-30 10:45:06.992447
76	CAD	SGD	0.986486	2026-07-30 10:45:06.992447
77	CAD	HKD	5.615385	2026-07-30 10:45:06.992447
78	AUD	VLM	0.496241	2026-07-30 10:45:06.992447
79	AUD	TWD	21.290323	2026-07-30 10:45:06.992447
80	AUD	USD	0.660000	2026-07-30 10:45:06.992447
81	AUD	EUR	0.611111	2026-07-30 10:45:06.992447
82	AUD	GBP	0.515625	2026-07-30 10:45:06.992447
83	AUD	JPY	106.451613	2026-07-30 10:45:06.992447
84	AUD	CAD	0.904110	2026-07-30 10:45:06.992447
85	AUD	CHF	0.594595	2026-07-30 10:45:06.992447
86	AUD	CNY	4.714286	2026-07-30 10:45:06.992447
87	AUD	SGD	0.891892	2026-07-30 10:45:06.992447
88	AUD	HKD	5.076923	2026-07-30 10:45:06.992447
89	CHF	VLM	0.834586	2026-07-30 10:45:06.992447
90	CHF	TWD	35.806452	2026-07-30 10:45:06.992447
91	CHF	USD	1.110000	2026-07-30 10:45:06.992447
92	CHF	EUR	1.027778	2026-07-30 10:45:06.992447
93	CHF	GBP	0.867188	2026-07-30 10:45:06.992447
94	CHF	JPY	179.032258	2026-07-30 10:45:06.992447
95	CHF	CAD	1.520548	2026-07-30 10:45:06.992447
96	CHF	AUD	1.681818	2026-07-30 10:45:06.992447
97	CHF	CNY	7.928571	2026-07-30 10:45:06.992447
98	CHF	SGD	1.500000	2026-07-30 10:45:06.992447
99	CHF	HKD	8.538462	2026-07-30 10:45:06.992447
100	CNY	VLM	0.105263	2026-07-30 10:45:06.992447
101	CNY	TWD	4.516129	2026-07-30 10:45:06.992447
102	CNY	USD	0.140000	2026-07-30 10:45:06.992447
103	CNY	EUR	0.129630	2026-07-30 10:45:06.992447
104	CNY	GBP	0.109375	2026-07-30 10:45:06.992447
105	CNY	JPY	22.580645	2026-07-30 10:45:06.992447
106	CNY	CAD	0.191781	2026-07-30 10:45:06.992447
107	CNY	AUD	0.212121	2026-07-30 10:45:06.992447
108	CNY	CHF	0.126126	2026-07-30 10:45:06.992447
109	CNY	SGD	0.189189	2026-07-30 10:45:06.992447
110	CNY	HKD	1.076923	2026-07-30 10:45:06.992447
111	SGD	VLM	0.556391	2026-07-30 10:45:06.992447
112	SGD	TWD	23.870968	2026-07-30 10:45:06.992447
113	SGD	USD	0.740000	2026-07-30 10:45:06.992447
114	SGD	EUR	0.685185	2026-07-30 10:45:06.992447
115	SGD	GBP	0.578125	2026-07-30 10:45:06.992447
116	SGD	JPY	119.354839	2026-07-30 10:45:06.992447
117	SGD	CAD	1.013699	2026-07-30 10:45:06.992447
118	SGD	AUD	1.121212	2026-07-30 10:45:06.992447
119	SGD	CHF	0.666667	2026-07-30 10:45:06.992447
120	SGD	CNY	5.285714	2026-07-30 10:45:06.992447
121	SGD	HKD	5.692308	2026-07-30 10:45:06.992447
122	HKD	VLM	0.097744	2026-07-30 10:45:06.992447
123	HKD	TWD	4.193548	2026-07-30 10:45:06.992447
124	HKD	USD	0.130000	2026-07-30 10:45:06.992447
125	HKD	EUR	0.120370	2026-07-30 10:45:06.992447
126	HKD	GBP	0.101563	2026-07-30 10:45:06.992447
127	HKD	JPY	20.967742	2026-07-30 10:45:06.992447
128	HKD	CAD	0.178082	2026-07-30 10:45:06.992447
129	HKD	AUD	0.196970	2026-07-30 10:45:06.992447
130	HKD	CHF	0.117117	2026-07-30 10:45:06.992447
131	HKD	CNY	0.928571	2026-07-30 10:45:06.992447
132	HKD	SGD	0.175676	2026-07-30 10:45:06.992447
\.


--
-- Data for Name: ip_addresses; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.ip_addresses (id, user_id, ip_address, device_id, first_seen, last_seen, is_current, access_count) FROM stdin;
\.


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.listings (id, seller_id, title, description, price, category, stock, digital_delivery, digital_payload, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lounge_members; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.lounge_members (id, lounge_id, user_id, role, status, joined_at) FROM stdin;
\.


--
-- Data for Name: lounges; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.lounges (id, slug, name, description, owner_id, parent_lounge_id, is_official, is_system, is_private, is_hidden, invite_code, access_level, type, last_message_at, created_at, updated_at, avatar_url, last_message_text, last_message_sender_id, guidelines) FROM stdin;
160	dm_velum_621	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 00:11:42.446229	2026-08-07 00:11:42.446229	\N	\N	\N	\N
35	dm_velum_599	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 01:02:06.920849	2026-07-30 01:02:06.920849	\N	\N	\N	\N
37	dm_velum_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 22:31:21.424555	2026-07-30 22:31:21.424555	\N	\N	\N	\N
38	dm_velum_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-03 23:36:11.075144	2026-08-03 23:36:11.075144	\N	\N	\N	\N
39	dm_velum_604	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-03 23:39:03.728653	2026-08-03 23:39:03.728653	\N	\N	\N	\N
42	dm_velum_311	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.199684	2026-08-04 02:12:00.199684	\N	\N	\N	\N
43	dm_velum_312	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.219013	2026-08-04 02:12:00.219013	\N	\N	\N	\N
44	dm_velum_313	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.245218	2026-08-04 02:12:00.245218	\N	\N	\N	\N
45	dm_velum_314	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.286445	2026-08-04 02:12:00.286445	\N	\N	\N	\N
46	dm_velum_315	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.310217	2026-08-04 02:12:00.310217	\N	\N	\N	\N
47	dm_velum_316	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.392889	2026-08-04 02:12:00.392889	\N	\N	\N	\N
48	dm_velum_317	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.415933	2026-08-04 02:12:00.415933	\N	\N	\N	\N
49	dm_velum_318	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.427149	2026-08-04 02:12:00.427149	\N	\N	\N	\N
50	dm_velum_319	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.436645	2026-08-04 02:12:00.436645	\N	\N	\N	\N
51	dm_velum_320	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.44668	2026-08-04 02:12:00.44668	\N	\N	\N	\N
52	dm_velum_322	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.456474	2026-08-04 02:12:00.456474	\N	\N	\N	\N
53	dm_velum_321	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.46627	2026-08-04 02:12:00.46627	\N	\N	\N	\N
54	dm_velum_323	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.476251	2026-08-04 02:12:00.476251	\N	\N	\N	\N
55	dm_velum_324	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.486046	2026-08-04 02:12:00.486046	\N	\N	\N	\N
56	dm_velum_424	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.495185	2026-08-04 02:12:00.495185	\N	\N	\N	\N
57	dm_velum_425	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.504744	2026-08-04 02:12:00.504744	\N	\N	\N	\N
58	dm_velum_426	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.514734	2026-08-04 02:12:00.514734	\N	\N	\N	\N
59	dm_velum_427	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.524229	2026-08-04 02:12:00.524229	\N	\N	\N	\N
60	dm_velum_428	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.534172	2026-08-04 02:12:00.534172	\N	\N	\N	\N
61	dm_velum_429	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.543528	2026-08-04 02:12:00.543528	\N	\N	\N	\N
62	dm_velum_430	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.558497	2026-08-04 02:12:00.558497	\N	\N	\N	\N
63	dm_velum_431	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.569485	2026-08-04 02:12:00.569485	\N	\N	\N	\N
64	dm_velum_432	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.578893	2026-08-04 02:12:00.578893	\N	\N	\N	\N
65	dm_velum_433	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.588139	2026-08-04 02:12:00.588139	\N	\N	\N	\N
66	dm_velum_434	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.594797	2026-08-04 02:12:00.594797	\N	\N	\N	\N
67	dm_velum_435	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.604709	2026-08-04 02:12:00.604709	\N	\N	\N	\N
68	dm_velum_436	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.614581	2026-08-04 02:12:00.614581	\N	\N	\N	\N
69	dm_velum_437	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.624631	2026-08-04 02:12:00.624631	\N	\N	\N	\N
70	dm_velum_438	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.632012	2026-08-04 02:12:00.632012	\N	\N	\N	\N
71	dm_velum_439	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.64169	2026-08-04 02:12:00.64169	\N	\N	\N	\N
72	dm_velum_440	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.652131	2026-08-04 02:12:00.652131	\N	\N	\N	\N
73	dm_velum_2	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.662394	2026-08-04 02:12:00.662394	\N	\N	\N	\N
74	dm_velum_441	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.674257	2026-08-04 02:12:00.674257	\N	\N	\N	\N
75	dm_velum_442	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.680991	2026-08-04 02:12:00.680991	\N	\N	\N	\N
76	dm_velum_443	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.690572	2026-08-04 02:12:00.690572	\N	\N	\N	\N
77	dm_velum_449	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.700902	2026-08-04 02:12:00.700902	\N	\N	\N	\N
78	dm_velum_453	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.710829	2026-08-04 02:12:00.710829	\N	\N	\N	\N
79	dm_velum_454	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.720893	2026-08-04 02:12:00.720893	\N	\N	\N	\N
80	dm_velum_444	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.733549	2026-08-04 02:12:00.733549	\N	\N	\N	\N
81	dm_velum_445	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.743725	2026-08-04 02:12:00.743725	\N	\N	\N	\N
82	dm_velum_446	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.75399	2026-08-04 02:12:00.75399	\N	\N	\N	\N
83	dm_velum_456	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.761375	2026-08-04 02:12:00.761375	\N	\N	\N	\N
84	dm_velum_447	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.771889	2026-08-04 02:12:00.771889	\N	\N	\N	\N
85	dm_velum_448	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.782181	2026-08-04 02:12:00.782181	\N	\N	\N	\N
86	dm_velum_450	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.792021	2026-08-04 02:12:00.792021	\N	\N	\N	\N
87	dm_velum_451	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.802398	2026-08-04 02:12:00.802398	\N	\N	\N	\N
88	dm_velum_459	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.812219	2026-08-04 02:12:00.812219	\N	\N	\N	\N
89	dm_velum_452	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.822147	2026-08-04 02:12:00.822147	\N	\N	\N	\N
90	dm_velum_455	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.832636	2026-08-04 02:12:00.832636	\N	\N	\N	\N
91	dm_velum_457	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.843151	2026-08-04 02:12:00.843151	\N	\N	\N	\N
92	dm_velum_458	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.853024	2026-08-04 02:12:00.853024	\N	\N	\N	\N
93	dm_velum_460	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.862919	2026-08-04 02:12:00.862919	\N	\N	\N	\N
94	dm_velum_461	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.872717	2026-08-04 02:12:00.872717	\N	\N	\N	\N
95	dm_velum_462	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.883011	2026-08-04 02:12:00.883011	\N	\N	\N	\N
96	dm_velum_463	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.893166	2026-08-04 02:12:00.893166	\N	\N	\N	\N
97	dm_velum_464	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.902641	2026-08-04 02:12:00.902641	\N	\N	\N	\N
98	dm_velum_465	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.91327	2026-08-04 02:12:00.91327	\N	\N	\N	\N
99	dm_velum_466	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.923221	2026-08-04 02:12:00.923221	\N	\N	\N	\N
100	dm_velum_467	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.935	2026-08-04 02:12:00.935	\N	\N	\N	\N
101	dm_velum_468	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.943523	2026-08-04 02:12:00.943523	\N	\N	\N	\N
102	dm_velum_469	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.953585	2026-08-04 02:12:00.953585	\N	\N	\N	\N
103	dm_velum_470	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.963654	2026-08-04 02:12:00.963654	\N	\N	\N	\N
104	dm_velum_471	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.974087	2026-08-04 02:12:00.974087	\N	\N	\N	\N
161	dm_velum_622	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:36.804759	2026-08-07 17:56:36.804759	\N	\N	\N	\N
7	velum_bugs	Bug Reports	Report system bugs & technical issues	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.138308	2026-07-29 13:02:25.138308	\N	\N	\N	\N
13	velum_executives	Executive Lounge	Restricted executive & governance channel	\N	1	t	t	t	t	\N	EXEC_ONLY	private_sublounge	2026-08-08 03:57:39.164	2026-07-29 13:02:25.273234	2026-08-08 03:57:39.164	\N	VEL_E2EE[HCImMic4L1QvIjYRDw==]	\N	\N
1	velum_master_lounge	Test	Test desc	\N	\N	t	t	f	f	VL/M-R699	ALL	official	\N	2026-07-29 13:02:24.995148	2026-08-09 06:54:58.617	http://test.com	\N	\N	\N
8	velum_support	Support	Velum customer support & ticket assistance	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.188824	2026-07-29 13:02:25.188824	\N	\N	\N	\N
9	velum_suggestions	Suggestions	Propose new features & platform improvements	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.209573	2026-07-29 13:02:25.209573	\N	\N	\N	\N
105	dm_velum_472	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.984625	2026-08-04 02:12:00.984625	\N	\N	\N	\N
106	dm_velum_473	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.997106	2026-08-04 02:12:00.997106	\N	\N	\N	\N
107	dm_velum_474	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.004984	2026-08-04 02:12:01.004984	\N	\N	\N	\N
108	dm_velum_475	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.011566	2026-08-04 02:12:01.011566	\N	\N	\N	\N
109	dm_velum_476	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.020089	2026-08-04 02:12:01.020089	\N	\N	\N	\N
110	dm_velum_477	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.027166	2026-08-04 02:12:01.027166	\N	\N	\N	\N
111	dm_velum_478	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.035381	2026-08-04 02:12:01.035381	\N	\N	\N	\N
112	dm_velum_479	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.046525	2026-08-04 02:12:01.046525	\N	\N	\N	\N
113	dm_velum_480	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.054086	2026-08-04 02:12:01.054086	\N	\N	\N	\N
114	dm_velum_481	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.060642	2026-08-04 02:12:01.060642	\N	\N	\N	\N
142	dm_velum_609	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.33467	2026-08-04 02:12:01.33467	\N	\N	\N	\N
143	dm_velum_610	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.351183	2026-08-04 02:12:01.351183	\N	\N	\N	\N
144	dm_velum_611	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.364513	2026-08-04 02:12:01.364513	\N	\N	\N	\N
145	dm_velum_612	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.376528	2026-08-04 02:12:01.376528	\N	\N	\N	\N
146	dm_velum_613	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.392061	2026-08-04 02:12:01.392061	\N	\N	\N	\N
147	dm_velum_614	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.403598	2026-08-04 02:12:01.403598	\N	\N	\N	\N
148	dm_velum_615	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.415158	2026-08-04 02:12:01.415158	\N	\N	\N	\N
149	dm_velum_616	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.427826	2026-08-04 02:12:01.427826	\N	\N	\N	\N
150	dm_velum_1	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.450575	2026-08-04 02:12:01.450575	\N	\N	\N	\N
10	velum_events	Live Events	Community events & scheduled discussions	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.230714	2026-08-05 16:24:04.176	\N	\N	\N	\N
159	dm_velum_619	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-05 20:03:56.023511	2026-08-05 20:03:56.023511	\N	\N	\N	\N
156	dm_604_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 04:20:45.634142	2026-08-06 01:23:28.806	\N	\N	\N	\N
162	dm_velum_623	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:36.805995	2026-08-07 17:56:36.805995	\N	\N	\N	\N
163	dm_velum_624	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:37.237415	2026-08-07 17:56:37.237415	\N	\N	\N	\N
164	dm_velum_625	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:38.02047	2026-08-07 17:56:38.02047	\N	\N	\N	\N
115	dm_velum_482	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.067358	2026-08-04 02:12:01.067358	\N	\N	\N	\N
116	dm_velum_483	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.074494	2026-08-04 02:12:01.074494	\N	\N	\N	\N
117	dm_velum_484	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.081528	2026-08-04 02:12:01.081528	\N	\N	\N	\N
118	dm_velum_485	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.088977	2026-08-04 02:12:01.088977	\N	\N	\N	\N
119	dm_velum_486	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.094761	2026-08-04 02:12:01.094761	\N	\N	\N	\N
120	dm_velum_487	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.10421	2026-08-04 02:12:01.10421	\N	\N	\N	\N
121	dm_velum_488	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.113794	2026-08-04 02:12:01.113794	\N	\N	\N	\N
122	dm_velum_489	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.123587	2026-08-04 02:12:01.123587	\N	\N	\N	\N
123	dm_velum_490	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.134271	2026-08-04 02:12:01.134271	\N	\N	\N	\N
124	dm_velum_491	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.144694	2026-08-04 02:12:01.144694	\N	\N	\N	\N
125	dm_velum_492	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.154652	2026-08-04 02:12:01.154652	\N	\N	\N	\N
126	dm_velum_493	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.161736	2026-08-04 02:12:01.161736	\N	\N	\N	\N
127	dm_velum_494	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.172617	2026-08-04 02:12:01.172617	\N	\N	\N	\N
128	dm_velum_495	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.182506	2026-08-04 02:12:01.182506	\N	\N	\N	\N
129	dm_velum_496	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.191061	2026-08-04 02:12:01.191061	\N	\N	\N	\N
130	dm_velum_497	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.199152	2026-08-04 02:12:01.199152	\N	\N	\N	\N
131	dm_velum_498	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.207817	2026-08-04 02:12:01.207817	\N	\N	\N	\N
132	dm_velum_598	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.215688	2026-08-04 02:12:01.215688	\N	\N	\N	\N
133	dm_velum_600	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.223888	2026-08-04 02:12:01.223888	\N	\N	\N	\N
134	dm_velum_601	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.233547	2026-08-04 02:12:01.233547	\N	\N	\N	\N
135	dm_velum_602	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.243898	2026-08-04 02:12:01.243898	\N	\N	\N	\N
136	dm_velum_603	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.256574	2026-08-04 02:12:01.256574	\N	\N	\N	\N
137	dm_velum_999	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.271452	2026-08-04 02:12:01.271452	\N	\N	\N	\N
138	dm_velum_605	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.284639	2026-08-04 02:12:01.284639	\N	\N	\N	\N
139	dm_velum_606	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.296803	2026-08-04 02:12:01.296803	\N	\N	\N	\N
140	dm_velum_607	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.308256	2026-08-04 02:12:01.308256	\N	\N	\N	\N
141	dm_velum_608	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.321096	2026-08-04 02:12:01.321096	\N	\N	\N	\N
154	dm_617_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-07 00:23:31.778	2026-08-04 04:20:20.753873	2026-08-07 00:23:31.778	\N	VEL_E2EE[Gygh]	\N	\N
3	velum_market	Marketplace	Official trading & commerce discussions	\N	1	t	t	f	f	\N	ALL	official	2026-08-07 18:36:45.732	2026-07-29 13:02:25.05238	2026-08-07 18:36:45.732	\N	VEL_E2EE[HiA1LDg=]	\N	\N
2	velum_general	General	Main community chat & general discussion	\N	1	t	t	f	f	\N	ALL	official	2026-08-07 18:43:03.892	2026-07-29 13:02:25.026172	2026-08-07 18:43:03.892	\N	VEL_E2EE[HiA1]	\N	\N
170	dm_velum_620	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-08 15:48:46.523873	2026-08-08 15:48:46.523873	\N	\N	\N	\N
172	dm_velum_626	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-08 18:44:20.035215	2026-08-08 18:44:20.035215	\N	\N	\N	\N
173	dm_velum_627	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-08 18:44:32.312587	2026-08-08 18:44:32.312587	\N	\N	\N	\N
174	dm_velum_628	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-08 18:44:40.999129	2026-08-08 18:44:40.999129	\N	\N	\N	\N
175	dm_velum_629	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-08 18:44:42.973789	2026-08-08 18:44:42.973789	\N	\N	\N	\N
40	dm_599_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 03:22:01.92	2026-08-04 01:34:50.111866	2026-08-08 03:22:01.92	\N	VEL_E2EE[DRMjPC46ZXwqMTpETTtAS1grX15WbHR8Jm0qN15/LSsQHSwPFhYvQ1MVb3F9bS4+cwUhJDtWWToBXFtpAgcPMnEqNC46JAF3dWhKH20bXVwpGVxdMiwteHtufR90cmdSXGoMCgtvAAYLeDIpNyAC]	\N	\N
155	dm_599_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 13:32:04.167	2026-08-04 04:20:37.740806	2026-08-08 13:32:04.167	\N	VEL_E2EE[DQQ4ISw8LV8gKyteTWsFDwpxXEFQdjYlLyhldwJlDh1EGSZFXAM2W1BQM2omJSg4ZUc3KWVLGC9ZVlg7RR5aMyElNGBqfAtodGhcW24MDABvAAcBYWsmJSoCZWkEMSsFDjdYXFcrDBEDZnx6eycvIhI2LCUBV2wHABkUdBFDLzUpbyQyJFUgajUUCDgVTEszDB5CJikjNCksal8gITYFQGoMABRuAQkBZ3x5bH9ucQd2azUUCgI=]	\N	\N
152	sublounge_1785801254653	Yooh	\N	\N	151	f	f	t	f	VL/S-WWC2	ALL	user_created	\N	2026-08-04 02:54:14.67494	2026-08-04 02:54:14.67494	\N	\N	\N	\N
153	sublounge_1785801278171	Yes	\N	\N	151	f	f	f	f	\N	ALL	user_created	\N	2026-08-04 02:54:38.173246	2026-08-04 02:54:38.173246	\N	\N	\N	\N
151	lounge_1785800647438	Taipei	Hello	\N	\N	f	f	t	f	VL/M-FQ26	ALL	user_created	\N	2026-08-04 02:44:07.446022	2026-08-08 19:13:53.095	/uploads/avatar-599-1786216428909.webp	\N	\N	\N
5	velum_offtopic	Offtopic	Casual banter, games, & off-topic chatter	\N	1	t	t	f	f	\N	ALL	official	2026-08-08 01:46:41.92	2026-07-29 13:02:25.09744	2026-08-08 01:46:41.92	\N	VEL_E2EE[DQQ4ISw8LV8gKytMRVhFVW1BDBYTTwMAGTN/fWB6fw5wZTEmBgBWHAA+CANJHh8VDkMjNyBvYio1XiokOwVKARAJNg5LV1leR1FVZ3B/YHRscwB0azUGAjFVNh4bEgcXBx0MDSJ/bGF9Z3UcLzU4VhYFDwhlXlBeVCQySRcvNSlvJDIkVSBqNQYAC1UYLQNcSQEfHAYCMjZjOCg7LFNodHJHUlRDXGpcU19CXEhZTTw1KwhtBARGMSQ8HggJGxllT1JWTFdeAxMxZT88Nzp/AXJ9fz0nTAEULwpcDxkOFwxMPDUpMm0qN15/aioGCQMUCSxACwMQBhFEUnt0e217bnABc3VvRFdbWwcvCDs=]	\N	\N
176	sublounge_1786217382393	Yesx	\N	\N	1	f	f	t	f	VL/S-MQNA	ALL	user_created	\N	2026-08-08 19:29:42.538212	2026-08-08 19:29:42.538212	\N	\N	\N	\N
4	velum_escrow	Escrow Operations	Escrow status & secure trade support	\N	1	t	t	f	f	\N	ALL	official	2026-08-07 22:16:15.782	2026-07-29 13:02:25.071622	2026-08-07 22:16:15.782	\N	Hi0kPzg=	\N	\N
157	dm_604_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 16:44:18.396	2026-08-04 04:21:03.305133	2026-08-08 16:44:18.396	\N	VEL_E2EE[HiA1]	\N	\N
36	dm_599_604	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 14:04:16.446	2026-07-30 20:32:13.288099	2026-08-08 14:04:16.446	\N	VEL_E2EE[HiA1LA==]	\N	\N
12	velum_announcements	Announcements	Official Velum platform updates & news	\N	1	t	t	f	f	\N	ANNOUNCE	official	2026-08-08 15:47:43.085	2026-07-29 13:02:25.253159	2026-08-08 15:47:43.085	\N	VEL_E2EE[HiA1LDQmZVUwPCw=]	\N	\N
\.


--
-- Data for Name: message_reactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.message_reactions (id, message_id, user_id, emoji, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.messages (id, lounge_id, sender_id, content, encrypted, created_at, delivered_to, read_by, is_edited, edited_at, is_pinned, reply_to) FROM stdin;
\.


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.outbox_events (id, event_type, aggregate_id, payload, processed, created_at) FROM stdin;
\.


--
-- Data for Name: relationships; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.relationships (id, user_id, friend_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: reserves; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.reserves (id, reserve_type, balance_cents, updated_at) FROM stdin;
37	VELUM CENTRAL BANK	1000000000	2026-07-30 10:57:11.677871
38	SENTRY BANK	10000000	2026-07-30 10:57:11.71572
39	VELUM TRADING ACCOUNT	10000000	2026-07-30 10:57:11.742987
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: support_admin_nominations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.support_admin_nominations (id, nominated_user_id, nominated_by, status, admin_account_id, credentials, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tickets (id, user_id, subject, description, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.transactions (id, reference, wallet_id, type, amount, status, description, created_at) FROM stdin;
\.


--
-- Data for Name: user_devices; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_devices (id, user_id, device_id, first_seen, last_seen, is_current) FROM stdin;
\.


--
-- Data for Name: user_prekeys; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_prekeys (id, user_id, identity_key, signed_prekey, signed_prekey_signature, one_time_prekeys, updated_at) FROM stdin;
\.


--
-- Data for Name: user_unread_counts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_unread_counts (user_id, lounge_id, unread_count, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password_hash, salt, passcode_hash, panic_phrase_hash, recovery_key_hash, login_recovery_key_hash, duress_active, is_compromised, compromise_ticket_id, role, display_name, avatar_url, bio, created_at, updated_at, location, recovery_key, recovery_key_delivered) FROM stdin;
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.wallets (id, user_id, balance, currency, created_at, updated_at) FROM stdin;
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: neondb_owner
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 91, true);


--
-- Name: cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.cards_id_seq', 8, true);


--
-- Name: devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.devices_id_seq', 1, false);


--
-- Name: escrows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.escrows_id_seq', 1, false);


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.exchange_rates_id_seq', 132, true);


--
-- Name: ip_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.ip_addresses_id_seq', 1, false);


--
-- Name: listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.listings_id_seq', 15, true);


--
-- Name: lounge_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.lounge_members_id_seq', 16, true);


--
-- Name: lounges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.lounges_id_seq', 176, true);


--
-- Name: message_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.message_reactions_id_seq', 6, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.messages_id_seq', 959, true);


--
-- Name: outbox_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.outbox_events_id_seq', 1, false);


--
-- Name: relationships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.relationships_id_seq', 9, true);


--
-- Name: reserves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.reserves_id_seq', 39, true);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.sessions_id_seq', 510, true);


--
-- Name: support_admin_nominations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.support_admin_nominations_id_seq', 2, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tickets_id_seq', 2, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.transactions_id_seq', 93, true);


--
-- Name: user_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.user_devices_id_seq', 1, false);


--
-- Name: user_prekeys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.user_prekeys_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 629, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.wallets_id_seq', 140, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: neondb_owner
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_log_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_log_id_unique UNIQUE (log_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cards cards_card_token_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_card_token_unique UNIQUE (card_token);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: cards cards_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_user_id_unique UNIQUE (user_id);


--
-- Name: devices devices_device_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_device_id_unique UNIQUE (device_id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: escrows escrows_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: ip_addresses ip_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_pkey PRIMARY KEY (id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: lounge_members lounge_members_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounge_members
    ADD CONSTRAINT lounge_members_pkey PRIMARY KEY (id);


--
-- Name: lounges lounges_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_pkey PRIMARY KEY (id);


--
-- Name: lounges lounges_slug_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_slug_unique UNIQUE (slug);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: relationships relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_pkey PRIMARY KEY (id);


--
-- Name: reserves reserves_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reserves
    ADD CONSTRAINT reserves_pkey PRIMARY KEY (id);


--
-- Name: reserves reserves_reserve_type_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reserves
    ADD CONSTRAINT reserves_reserve_type_unique UNIQUE (reserve_type);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: support_admin_nominations support_admin_nominations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.support_admin_nominations
    ADD CONSTRAINT support_admin_nominations_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_reference_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_reference_unique UNIQUE (reference);


--
-- Name: message_reactions unique_message_user_emoji; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT unique_message_user_emoji UNIQUE (message_id, user_id, emoji);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_prekeys user_prekeys_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_prekeys
    ADD CONSTRAINT user_prekeys_pkey PRIMARY KEY (id);


--
-- Name: user_prekeys user_prekeys_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_prekeys
    ADD CONSTRAINT user_prekeys_user_id_unique UNIQUE (user_id);


--
-- Name: user_unread_counts user_unread_counts_user_id_lounge_id_pk; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_unread_counts
    ADD CONSTRAINT user_unread_counts_user_id_lounge_id_pk PRIMARY KEY (user_id, lounge_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: idx_cards_token; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cards_token ON public.cards USING btree (card_token);


--
-- Name: idx_cards_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_cards_user_id ON public.cards USING btree (user_id);


--
-- Name: idx_devices_device_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_devices_device_id ON public.devices USING btree (device_id);


--
-- Name: idx_devices_fingerprint; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_devices_fingerprint ON public.devices USING btree (device_fingerprint);


--
-- Name: idx_escrows_buyer_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_escrows_buyer_id ON public.escrows USING btree (buyer_id);


--
-- Name: idx_escrows_listing_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_escrows_listing_id ON public.escrows USING btree (listing_id);


--
-- Name: idx_escrows_seller_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_escrows_seller_id ON public.escrows USING btree (seller_id);


--
-- Name: idx_exchange_rates_pair; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_exchange_rates_pair ON public.exchange_rates USING btree (base_currency, quote_currency);


--
-- Name: idx_ip_addresses_ip; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_ip_addresses_ip ON public.ip_addresses USING btree (ip_address);


--
-- Name: idx_ip_addresses_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_ip_addresses_user_id ON public.ip_addresses USING btree (user_id);


--
-- Name: idx_listings_category; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_listings_category ON public.listings USING btree (category);


--
-- Name: idx_listings_seller_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_listings_seller_id ON public.listings USING btree (seller_id);


--
-- Name: idx_lounge_members_lounge_user; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_lounge_members_lounge_user ON public.lounge_members USING btree (lounge_id, user_id);


--
-- Name: idx_lounges_last_message_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_lounges_last_message_at ON public.lounges USING btree (last_message_at);


--
-- Name: idx_lounges_owner_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_lounges_owner_id ON public.lounges USING btree (owner_id);


--
-- Name: idx_lounges_parent_lounge_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_lounges_parent_lounge_id ON public.lounges USING btree (parent_lounge_id);


--
-- Name: idx_lounges_slug; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_lounges_slug ON public.lounges USING btree (slug);


--
-- Name: idx_message_reactions_message; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_message_reactions_message ON public.message_reactions USING btree (message_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_lounge_created; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_messages_lounge_created ON public.messages USING btree (lounge_id, created_at);


--
-- Name: idx_messages_lounge_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_messages_lounge_id ON public.messages USING btree (lounge_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_nominations_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_nominations_status ON public.support_admin_nominations USING btree (status);


--
-- Name: idx_nominations_user; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_nominations_user ON public.support_admin_nominations USING btree (nominated_user_id);


--
-- Name: idx_relationships_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_relationships_status ON public.relationships USING btree (status);


--
-- Name: idx_relationships_user_friend; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_relationships_user_friend ON public.relationships USING btree (user_id, friend_id);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_tx_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_tx_created_at ON public.transactions USING btree (created_at);


--
-- Name: idx_tx_wallet_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_tx_wallet_id ON public.transactions USING btree (wallet_id);


--
-- Name: idx_user_devices_device_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_devices_device_id ON public.user_devices USING btree (device_id);


--
-- Name: idx_user_devices_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_devices_user_id ON public.user_devices USING btree (user_id);


--
-- Name: idx_user_prekeys_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_prekeys_user_id ON public.user_prekeys USING btree (user_id);


--
-- Name: idx_user_unread_counts_lounge; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_unread_counts_lounge ON public.user_unread_counts USING btree (lounge_id);


--
-- Name: idx_user_unread_counts_user; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_user_unread_counts_user ON public.user_unread_counts USING btree (user_id);


--
-- Name: idx_wallets_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_wallets_user_id ON public.wallets USING btree (user_id);


--
-- Name: cards cards_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: escrows escrows_buyer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_buyer_id_users_id_fk FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: escrows escrows_listing_id_listings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_listing_id_listings_id_fk FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: escrows escrows_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ip_addresses ip_addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lounge_members lounge_members_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounge_members
    ADD CONSTRAINT lounge_members_lounge_id_lounges_id_fk FOREIGN KEY (lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: lounge_members lounge_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounge_members
    ADD CONSTRAINT lounge_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lounges lounges_last_message_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_last_message_sender_id_users_id_fk FOREIGN KEY (last_message_sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lounges lounges_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lounges lounges_parent_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_parent_lounge_id_lounges_id_fk FOREIGN KEY (parent_lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_message_id_messages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_messages_id_fk FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_lounge_id_lounges_id_fk FOREIGN KEY (lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: relationships relationships_friend_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_friend_id_users_id_fk FOREIGN KEY (friend_id) REFERENCES public.users(id);


--
-- Name: relationships relationships_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_admin_nominations support_admin_nominations_nominated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.support_admin_nominations
    ADD CONSTRAINT support_admin_nominations_nominated_by_users_id_fk FOREIGN KEY (nominated_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_admin_nominations support_admin_nominations_nominated_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.support_admin_nominations
    ADD CONSTRAINT support_admin_nominations_nominated_user_id_users_id_fk FOREIGN KEY (nominated_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_wallet_id_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_wallet_id_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: user_devices user_devices_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_prekeys user_prekeys_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_prekeys
    ADD CONSTRAINT user_prekeys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_unread_counts user_unread_counts_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_unread_counts
    ADD CONSTRAINT user_unread_counts_lounge_id_lounges_id_fk FOREIGN KEY (lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: user_unread_counts user_unread_counts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_unread_counts
    ADD CONSTRAINT user_unread_counts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: neondb_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict nphcvmEkGWoDvg6vohiS0KPfEsR6Gs9d8707GMvY5FCCj5YBPlwUtrJvLcm7Bm2

