--
-- PostgreSQL database dump
--

\restrict ZlPI4Xc9eu6iLHQyCshIpLjvuo4wCfgpNpMNBVyM5O20wCn4LqnCmhsRmuJoxKg

-- Dumped from database version 18.2
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
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: u0_a345
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO u0_a345;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: u0_a345
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO u0_a345;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: u0_a345
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: u0_a345
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO u0_a345;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: u0_a345
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO u0_a345;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: u0_a345
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.audit_logs OWNER TO u0_a345;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO u0_a345;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: cards; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.cards OWNER TO u0_a345;

--
-- Name: cards_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cards_id_seq OWNER TO u0_a345;

--
-- Name: cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.cards_id_seq OWNED BY public.cards.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.devices OWNER TO u0_a345;

--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.devices_id_seq OWNER TO u0_a345;

--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: escrows; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.escrows OWNER TO u0_a345;

--
-- Name: escrows_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.escrows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.escrows_id_seq OWNER TO u0_a345;

--
-- Name: escrows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.escrows_id_seq OWNED BY public.escrows.id;


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.exchange_rates (
    id integer NOT NULL,
    base_currency character varying(8) NOT NULL,
    quote_currency character varying(8) NOT NULL,
    rate numeric(18,6) NOT NULL,
    effective_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exchange_rates OWNER TO u0_a345;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.exchange_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exchange_rates_id_seq OWNER TO u0_a345;

--
-- Name: exchange_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.exchange_rates_id_seq OWNED BY public.exchange_rates.id;


--
-- Name: ip_addresses; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.ip_addresses OWNER TO u0_a345;

--
-- Name: ip_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.ip_addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ip_addresses_id_seq OWNER TO u0_a345;

--
-- Name: ip_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.ip_addresses_id_seq OWNED BY public.ip_addresses.id;


--
-- Name: listings; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.listings OWNER TO u0_a345;

--
-- Name: listings_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.listings_id_seq OWNER TO u0_a345;

--
-- Name: listings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.listings_id_seq OWNED BY public.listings.id;


--
-- Name: lounge_members; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.lounge_members (
    id integer NOT NULL,
    lounge_id integer NOT NULL,
    user_id integer NOT NULL,
    role character varying(32) DEFAULT 'member'::character varying NOT NULL,
    status character varying(32) DEFAULT 'active'::character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.lounge_members OWNER TO u0_a345;

--
-- Name: lounge_members_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.lounge_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lounge_members_id_seq OWNER TO u0_a345;

--
-- Name: lounge_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.lounge_members_id_seq OWNED BY public.lounge_members.id;


--
-- Name: lounges; Type: TABLE; Schema: public; Owner: u0_a345
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
    last_message_sender_id integer
);


ALTER TABLE public.lounges OWNER TO u0_a345;

--
-- Name: lounges_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.lounges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lounges_id_seq OWNER TO u0_a345;

--
-- Name: lounges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.lounges_id_seq OWNED BY public.lounges.id;


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.message_reactions (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    emoji character varying(32) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.message_reactions OWNER TO u0_a345;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.message_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_reactions_id_seq OWNER TO u0_a345;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.message_reactions_id_seq OWNED BY public.message_reactions.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.messages OWNER TO u0_a345;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO u0_a345;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.outbox_events (
    id integer NOT NULL,
    event_type character varying(64) NOT NULL,
    aggregate_id character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.outbox_events OWNER TO u0_a345;

--
-- Name: outbox_events_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.outbox_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.outbox_events_id_seq OWNER TO u0_a345;

--
-- Name: outbox_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.outbox_events_id_seq OWNED BY public.outbox_events.id;


--
-- Name: relationships; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.relationships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    friend_id integer NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.relationships OWNER TO u0_a345;

--
-- Name: relationships_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.relationships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.relationships_id_seq OWNER TO u0_a345;

--
-- Name: relationships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.relationships_id_seq OWNED BY public.relationships.id;


--
-- Name: reserves; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.reserves (
    id integer NOT NULL,
    reserve_type character varying(32) NOT NULL,
    balance_cents integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reserves OWNER TO u0_a345;

--
-- Name: reserves_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.reserves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reserves_id_seq OWNER TO u0_a345;

--
-- Name: reserves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.reserves_id_seq OWNED BY public.reserves.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.sessions OWNER TO u0_a345;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sessions_id_seq OWNER TO u0_a345;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: support_admin_nominations; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.support_admin_nominations OWNER TO u0_a345;

--
-- Name: support_admin_nominations_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.support_admin_nominations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_admin_nominations_id_seq OWNER TO u0_a345;

--
-- Name: support_admin_nominations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.support_admin_nominations_id_seq OWNED BY public.support_admin_nominations.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.tickets OWNER TO u0_a345;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO u0_a345;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.transactions OWNER TO u0_a345;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO u0_a345;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.user_devices (
    id integer NOT NULL,
    user_id integer NOT NULL,
    device_id character varying(64) NOT NULL,
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT true NOT NULL
);


ALTER TABLE public.user_devices OWNER TO u0_a345;

--
-- Name: user_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.user_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_devices_id_seq OWNER TO u0_a345;

--
-- Name: user_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.user_devices_id_seq OWNED BY public.user_devices.id;


--
-- Name: user_prekeys; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.user_prekeys OWNER TO u0_a345;

--
-- Name: user_prekeys_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.user_prekeys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_prekeys_id_seq OWNER TO u0_a345;

--
-- Name: user_prekeys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.user_prekeys_id_seq OWNED BY public.user_prekeys.id;


--
-- Name: user_unread_counts; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.user_unread_counts (
    user_id integer NOT NULL,
    lounge_id integer NOT NULL,
    unread_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_unread_counts OWNER TO u0_a345;

--
-- Name: users; Type: TABLE; Schema: public; Owner: u0_a345
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


ALTER TABLE public.users OWNER TO u0_a345;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO u0_a345;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wallets; Type: TABLE; Schema: public; Owner: u0_a345
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    balance numeric(18,2) DEFAULT 0.00 NOT NULL,
    currency character varying(8) DEFAULT 'USD'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.wallets OWNER TO u0_a345;

--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: u0_a345
--

CREATE SEQUENCE public.wallets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wallets_id_seq OWNER TO u0_a345;

--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: u0_a345
--

ALTER SEQUENCE public.wallets_id_seq OWNED BY public.wallets.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: u0_a345
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: cards id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.cards ALTER COLUMN id SET DEFAULT nextval('public.cards_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: escrows id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.escrows ALTER COLUMN id SET DEFAULT nextval('public.escrows_id_seq'::regclass);


--
-- Name: exchange_rates id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.exchange_rates ALTER COLUMN id SET DEFAULT nextval('public.exchange_rates_id_seq'::regclass);


--
-- Name: ip_addresses id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.ip_addresses ALTER COLUMN id SET DEFAULT nextval('public.ip_addresses_id_seq'::regclass);


--
-- Name: listings id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.listings ALTER COLUMN id SET DEFAULT nextval('public.listings_id_seq'::regclass);


--
-- Name: lounge_members id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounge_members ALTER COLUMN id SET DEFAULT nextval('public.lounge_members_id_seq'::regclass);


--
-- Name: lounges id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounges ALTER COLUMN id SET DEFAULT nextval('public.lounges_id_seq'::regclass);


--
-- Name: message_reactions id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.message_reactions ALTER COLUMN id SET DEFAULT nextval('public.message_reactions_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: outbox_events id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.outbox_events ALTER COLUMN id SET DEFAULT nextval('public.outbox_events_id_seq'::regclass);


--
-- Name: relationships id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.relationships ALTER COLUMN id SET DEFAULT nextval('public.relationships_id_seq'::regclass);


--
-- Name: reserves id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.reserves ALTER COLUMN id SET DEFAULT nextval('public.reserves_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: support_admin_nominations id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.support_admin_nominations ALTER COLUMN id SET DEFAULT nextval('public.support_admin_nominations_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_devices id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_devices ALTER COLUMN id SET DEFAULT nextval('public.user_devices_id_seq'::regclass);


--
-- Name: user_prekeys id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_prekeys ALTER COLUMN id SET DEFAULT nextval('public.user_prekeys_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.wallets ALTER COLUMN id SET DEFAULT nextval('public.wallets_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: u0_a345
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: u0_a345
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
92	al_ed3339ab_audit	1	cli_admin	/users/demote	taiwan	CLI V2 Administrative Override	2026-08-08 17:05:30.477518
93	al_7233dfaa_audit	1	cli_admin	/users/demote	SA-taiwan	CLI V2 Administrative Override	2026-08-08 17:05:54.809358
94	al_912e2ae4_audit	1	cli_admin	/users/demote	618	CLI V2 Administrative Override	2026-08-08 17:06:18.39139
95	al_13b1b16a_audit	1	cli_admin	/users/demote	618	Demoted support admin	2026-08-08 17:06:18.589158
\.


--
-- Data for Name: cards; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.cards (id, user_id, card_token, card_type, limit_cents, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.devices (id, device_id, device_fingerprint, user_agent, platform, screen_resolution, timezone, language, hardware_concurrency, device_memory, webgl_vendor, webgl_renderer, first_seen, last_seen, access_count) FROM stdin;
\.


--
-- Data for Name: escrows; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.escrows (id, listing_id, buyer_id, seller_id, amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: exchange_rates; Type: TABLE DATA; Schema: public; Owner: u0_a345
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
-- Data for Name: ip_addresses; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.ip_addresses (id, user_id, ip_address, device_id, first_seen, last_seen, is_current, access_count) FROM stdin;
\.


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.listings (id, seller_id, title, description, price, category, stock, digital_delivery, digital_payload, status, created_at, updated_at) FROM stdin;
6	321	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-07-29 13:57:44.813532	2026-07-29 10:57:44.937
7	424	Dual Server Verification Payload	End-to-end integration test payload	50.00	Test	5	f	\N	ACTIVE	2026-07-29 14:01:26.984652	2026-07-29 14:01:26.984652
8	497	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-07-29 18:22:07.362557	2026-07-29 15:22:07.554
9	598	Dual Server Verification Payload	End-to-end integration test payload	50.00	Test	5	f	\N	ACTIVE	2026-07-29 18:22:23.629591	2026-07-29 18:22:23.629591
10	601	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-07-29 20:09:36.511702	2026-07-29 17:09:36.642
11	605	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-07-30 10:22:33.278211	2026-07-30 07:22:33.419
12	609	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-07-30 10:25:10.735566	2026-07-30 07:25:10.944
14	622	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-08-07 17:56:36.942802	2026-08-07 14:56:37.058
\.


--
-- Data for Name: lounge_members; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.lounge_members (id, lounge_id, user_id, role, status, joined_at) FROM stdin;
1	41	599	owner	active	2026-08-04 01:38:04.050764
2	151	599	owner	active	2026-08-04 02:44:07.466693
3	152	599	owner	active	2026-08-04 02:54:14.704063
4	153	599	owner	active	2026-08-04 02:54:38.182311
5	158	599	owner	active	2026-08-04 08:05:13.044137
\.


--
-- Data for Name: lounges; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.lounges (id, slug, name, description, owner_id, parent_lounge_id, is_official, is_system, is_private, is_hidden, invite_code, access_level, type, last_message_at, created_at, updated_at, avatar_url, last_message_text, last_message_sender_id) FROM stdin;
1	velum_master_lounge	Velum Lounge	Official Velum Master Network Lounge	\N	\N	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:24.995148	2026-07-29 13:02:24.995148	\N	\N	\N
160	dm_velum_621	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 00:11:42.446229	2026-08-07 00:11:42.446229	\N	\N	\N
4	velum_escrow	Escrow Operations	Escrow status & secure trade support	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.071622	2026-07-29 13:02:25.071622	\N	\N	\N
13	velum_executives	Executive Lounge	Restricted executive & governance channel	\N	1	t	t	t	t	\N	EXEC_ONLY	private_sublounge	\N	2026-07-29 13:02:25.273234	2026-07-29 13:02:25.273234	\N	\N	\N
35	dm_velum_599	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 01:02:06.920849	2026-07-30 01:02:06.920849	\N	\N	\N
37	dm_velum_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 22:31:21.424555	2026-07-30 22:31:21.424555	\N	\N	\N
38	dm_velum_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-03 23:36:11.075144	2026-08-03 23:36:11.075144	\N	\N	\N
39	dm_velum_604	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-03 23:39:03.728653	2026-08-03 23:39:03.728653	\N	\N	\N
41	lounge_1785796684037	CHINA	Chinese	599	\N	f	f	t	f	\N	ALL	user_created	\N	2026-08-04 01:38:04.040303	2026-08-04 01:38:04.040303	\N	\N	\N
42	dm_velum_311	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.199684	2026-08-04 02:12:00.199684	\N	\N	\N
43	dm_velum_312	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.219013	2026-08-04 02:12:00.219013	\N	\N	\N
44	dm_velum_313	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.245218	2026-08-04 02:12:00.245218	\N	\N	\N
45	dm_velum_314	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.286445	2026-08-04 02:12:00.286445	\N	\N	\N
46	dm_velum_315	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.310217	2026-08-04 02:12:00.310217	\N	\N	\N
47	dm_velum_316	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.392889	2026-08-04 02:12:00.392889	\N	\N	\N
48	dm_velum_317	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.415933	2026-08-04 02:12:00.415933	\N	\N	\N
49	dm_velum_318	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.427149	2026-08-04 02:12:00.427149	\N	\N	\N
50	dm_velum_319	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.436645	2026-08-04 02:12:00.436645	\N	\N	\N
51	dm_velum_320	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.44668	2026-08-04 02:12:00.44668	\N	\N	\N
52	dm_velum_322	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.456474	2026-08-04 02:12:00.456474	\N	\N	\N
53	dm_velum_321	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.46627	2026-08-04 02:12:00.46627	\N	\N	\N
54	dm_velum_323	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.476251	2026-08-04 02:12:00.476251	\N	\N	\N
55	dm_velum_324	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.486046	2026-08-04 02:12:00.486046	\N	\N	\N
56	dm_velum_424	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.495185	2026-08-04 02:12:00.495185	\N	\N	\N
57	dm_velum_425	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.504744	2026-08-04 02:12:00.504744	\N	\N	\N
58	dm_velum_426	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.514734	2026-08-04 02:12:00.514734	\N	\N	\N
59	dm_velum_427	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.524229	2026-08-04 02:12:00.524229	\N	\N	\N
60	dm_velum_428	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.534172	2026-08-04 02:12:00.534172	\N	\N	\N
61	dm_velum_429	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.543528	2026-08-04 02:12:00.543528	\N	\N	\N
62	dm_velum_430	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.558497	2026-08-04 02:12:00.558497	\N	\N	\N
63	dm_velum_431	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.569485	2026-08-04 02:12:00.569485	\N	\N	\N
64	dm_velum_432	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.578893	2026-08-04 02:12:00.578893	\N	\N	\N
65	dm_velum_433	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.588139	2026-08-04 02:12:00.588139	\N	\N	\N
66	dm_velum_434	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.594797	2026-08-04 02:12:00.594797	\N	\N	\N
67	dm_velum_435	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.604709	2026-08-04 02:12:00.604709	\N	\N	\N
68	dm_velum_436	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.614581	2026-08-04 02:12:00.614581	\N	\N	\N
69	dm_velum_437	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.624631	2026-08-04 02:12:00.624631	\N	\N	\N
70	dm_velum_438	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.632012	2026-08-04 02:12:00.632012	\N	\N	\N
71	dm_velum_439	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.64169	2026-08-04 02:12:00.64169	\N	\N	\N
72	dm_velum_440	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.652131	2026-08-04 02:12:00.652131	\N	\N	\N
73	dm_velum_2	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.662394	2026-08-04 02:12:00.662394	\N	\N	\N
74	dm_velum_441	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.674257	2026-08-04 02:12:00.674257	\N	\N	\N
75	dm_velum_442	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.680991	2026-08-04 02:12:00.680991	\N	\N	\N
76	dm_velum_443	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.690572	2026-08-04 02:12:00.690572	\N	\N	\N
77	dm_velum_449	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.700902	2026-08-04 02:12:00.700902	\N	\N	\N
78	dm_velum_453	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.710829	2026-08-04 02:12:00.710829	\N	\N	\N
79	dm_velum_454	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.720893	2026-08-04 02:12:00.720893	\N	\N	\N
80	dm_velum_444	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.733549	2026-08-04 02:12:00.733549	\N	\N	\N
81	dm_velum_445	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.743725	2026-08-04 02:12:00.743725	\N	\N	\N
82	dm_velum_446	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.75399	2026-08-04 02:12:00.75399	\N	\N	\N
83	dm_velum_456	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.761375	2026-08-04 02:12:00.761375	\N	\N	\N
84	dm_velum_447	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.771889	2026-08-04 02:12:00.771889	\N	\N	\N
85	dm_velum_448	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.782181	2026-08-04 02:12:00.782181	\N	\N	\N
86	dm_velum_450	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.792021	2026-08-04 02:12:00.792021	\N	\N	\N
87	dm_velum_451	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.802398	2026-08-04 02:12:00.802398	\N	\N	\N
88	dm_velum_459	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.812219	2026-08-04 02:12:00.812219	\N	\N	\N
89	dm_velum_452	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.822147	2026-08-04 02:12:00.822147	\N	\N	\N
90	dm_velum_455	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.832636	2026-08-04 02:12:00.832636	\N	\N	\N
91	dm_velum_457	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.843151	2026-08-04 02:12:00.843151	\N	\N	\N
92	dm_velum_458	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.853024	2026-08-04 02:12:00.853024	\N	\N	\N
93	dm_velum_460	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.862919	2026-08-04 02:12:00.862919	\N	\N	\N
94	dm_velum_461	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.872717	2026-08-04 02:12:00.872717	\N	\N	\N
95	dm_velum_462	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.883011	2026-08-04 02:12:00.883011	\N	\N	\N
96	dm_velum_463	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.893166	2026-08-04 02:12:00.893166	\N	\N	\N
97	dm_velum_464	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.902641	2026-08-04 02:12:00.902641	\N	\N	\N
98	dm_velum_465	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.91327	2026-08-04 02:12:00.91327	\N	\N	\N
12	velum_announcements	Announcements	Official Velum platform updates & news	\N	1	t	t	f	f	\N	ANNOUNCE	official	\N	2026-07-29 13:02:25.253159	2026-08-05 20:18:23.679	\N	\N	\N
99	dm_velum_466	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.923221	2026-08-04 02:12:00.923221	\N	\N	\N
100	dm_velum_467	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.935	2026-08-04 02:12:00.935	\N	\N	\N
101	dm_velum_468	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.943523	2026-08-04 02:12:00.943523	\N	\N	\N
102	dm_velum_469	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.953585	2026-08-04 02:12:00.953585	\N	\N	\N
103	dm_velum_470	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.963654	2026-08-04 02:12:00.963654	\N	\N	\N
104	dm_velum_471	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.974087	2026-08-04 02:12:00.974087	\N	\N	\N
3	velum_market	Marketplace	Official trading & commerce discussions	\N	1	t	t	f	f	\N	ALL	official	2026-08-06 12:20:24.332	2026-07-29 13:02:25.05238	2026-08-06 12:20:24.332	\N	VEL_E2EE[Hiw=]	1
161	dm_velum_622	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:36.804759	2026-08-07 17:56:36.804759	\N	\N	\N
5	velum_offtopic	Offtopic	Casual banter, games, & off-topic chatter	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.09744	2026-07-29 13:02:25.09744	\N	\N	\N
7	velum_bugs	Bug Reports	Report system bugs & technical issues	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.138308	2026-07-29 13:02:25.138308	\N	\N	\N
8	velum_support	Support	Velum customer support & ticket assistance	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.188824	2026-07-29 13:02:25.188824	\N	\N	\N
9	velum_suggestions	Suggestions	Propose new features & platform improvements	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.209573	2026-07-29 13:02:25.209573	\N	\N	\N
105	dm_velum_472	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.984625	2026-08-04 02:12:00.984625	\N	\N	\N
106	dm_velum_473	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.997106	2026-08-04 02:12:00.997106	\N	\N	\N
107	dm_velum_474	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.004984	2026-08-04 02:12:01.004984	\N	\N	\N
108	dm_velum_475	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.011566	2026-08-04 02:12:01.011566	\N	\N	\N
109	dm_velum_476	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.020089	2026-08-04 02:12:01.020089	\N	\N	\N
110	dm_velum_477	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.027166	2026-08-04 02:12:01.027166	\N	\N	\N
111	dm_velum_478	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.035381	2026-08-04 02:12:01.035381	\N	\N	\N
112	dm_velum_479	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.046525	2026-08-04 02:12:01.046525	\N	\N	\N
113	dm_velum_480	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.054086	2026-08-04 02:12:01.054086	\N	\N	\N
114	dm_velum_481	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.060642	2026-08-04 02:12:01.060642	\N	\N	\N
142	dm_velum_609	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.33467	2026-08-04 02:12:01.33467	\N	\N	\N
143	dm_velum_610	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.351183	2026-08-04 02:12:01.351183	\N	\N	\N
144	dm_velum_611	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.364513	2026-08-04 02:12:01.364513	\N	\N	\N
145	dm_velum_612	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.376528	2026-08-04 02:12:01.376528	\N	\N	\N
146	dm_velum_613	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.392061	2026-08-04 02:12:01.392061	\N	\N	\N
147	dm_velum_614	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.403598	2026-08-04 02:12:01.403598	\N	\N	\N
148	dm_velum_615	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.415158	2026-08-04 02:12:01.415158	\N	\N	\N
149	dm_velum_616	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.427826	2026-08-04 02:12:01.427826	\N	\N	\N
150	dm_velum_1	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.450575	2026-08-04 02:12:01.450575	\N	\N	\N
151	lounge_1785800647438	Taipei	Hello	599	\N	f	f	t	f	VL/M-FQ26	ALL	user_created	\N	2026-08-04 02:44:07.446022	2026-08-04 02:44:07.446022	\N	\N	\N
152	sublounge_1785801254653	Yooh	\N	599	151	f	f	t	f	VL/S-WWC2	ALL	user_created	\N	2026-08-04 02:54:14.67494	2026-08-04 02:54:14.67494	\N	\N	\N
153	sublounge_1785801278171	Yes	\N	599	151	f	f	f	f	\N	ALL	user_created	\N	2026-08-04 02:54:38.173246	2026-08-04 02:54:38.173246	\N	\N	\N
158	sublounge_1785819913029	Yes	\N	599	41	f	f	t	f	VL/S-ILVZ	ALL	user_created	\N	2026-08-04 08:05:13.032272	2026-08-04 08:05:13.032272	\N	\N	\N
2	velum_general	General	Main community chat & general discussion	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.026172	2026-08-05 19:22:34.782	\N	\N	\N
10	velum_events	Live Events	Community events & scheduled discussions	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.230714	2026-08-05 16:24:04.176	\N	\N	\N
159	dm_velum_619	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-05 20:03:56.023511	2026-08-05 20:03:56.023511	\N	\N	\N
156	dm_604_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 04:20:45.634142	2026-08-06 01:23:28.806	\N	\N	\N
154	dm_617_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-07 00:23:31.778	2026-08-04 04:20:20.753873	2026-08-07 00:23:31.778	\N	VEL_E2EE[Gygh]	618
162	dm_velum_623	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:36.805995	2026-08-07 17:56:36.805995	\N	\N	\N
163	dm_velum_624	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:37.237415	2026-08-07 17:56:37.237415	\N	\N	\N
157	dm_604_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 08:29:39.876	2026-08-04 04:21:03.305133	2026-08-08 08:29:39.876	\N	HiwNZAEbFF8VBGJm	604
40	dm_599_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 10:21:19.539	2026-08-04 01:34:50.111866	2026-08-08 10:21:19.539	\N	DyA/dSwxIRIrKg==	599
155	dm_599_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 11:21:51.917	2026-08-04 04:20:37.740806	2026-08-08 11:21:51.917	\N	GCo=	599
36	dm_599_604	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	2026-08-08 20:36:02.511	2026-07-30 20:32:13.288099	2026-08-08 20:36:02.511	\N	VEL_E2EE[HiA1LDQm]	604
164	dm_velum_625	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-07 17:56:38.02047	2026-08-07 17:56:38.02047	\N	\N	\N
115	dm_velum_482	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.067358	2026-08-04 02:12:01.067358	\N	\N	\N
116	dm_velum_483	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.074494	2026-08-04 02:12:01.074494	\N	\N	\N
117	dm_velum_484	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.081528	2026-08-04 02:12:01.081528	\N	\N	\N
118	dm_velum_485	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.088977	2026-08-04 02:12:01.088977	\N	\N	\N
119	dm_velum_486	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.094761	2026-08-04 02:12:01.094761	\N	\N	\N
120	dm_velum_487	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.10421	2026-08-04 02:12:01.10421	\N	\N	\N
121	dm_velum_488	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.113794	2026-08-04 02:12:01.113794	\N	\N	\N
122	dm_velum_489	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.123587	2026-08-04 02:12:01.123587	\N	\N	\N
123	dm_velum_490	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.134271	2026-08-04 02:12:01.134271	\N	\N	\N
124	dm_velum_491	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.144694	2026-08-04 02:12:01.144694	\N	\N	\N
125	dm_velum_492	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.154652	2026-08-04 02:12:01.154652	\N	\N	\N
126	dm_velum_493	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.161736	2026-08-04 02:12:01.161736	\N	\N	\N
127	dm_velum_494	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.172617	2026-08-04 02:12:01.172617	\N	\N	\N
128	dm_velum_495	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.182506	2026-08-04 02:12:01.182506	\N	\N	\N
129	dm_velum_496	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.191061	2026-08-04 02:12:01.191061	\N	\N	\N
130	dm_velum_497	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.199152	2026-08-04 02:12:01.199152	\N	\N	\N
131	dm_velum_498	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.207817	2026-08-04 02:12:01.207817	\N	\N	\N
132	dm_velum_598	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.215688	2026-08-04 02:12:01.215688	\N	\N	\N
133	dm_velum_600	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.223888	2026-08-04 02:12:01.223888	\N	\N	\N
134	dm_velum_601	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.233547	2026-08-04 02:12:01.233547	\N	\N	\N
135	dm_velum_602	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.243898	2026-08-04 02:12:01.243898	\N	\N	\N
136	dm_velum_603	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.256574	2026-08-04 02:12:01.256574	\N	\N	\N
137	dm_velum_999	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.271452	2026-08-04 02:12:01.271452	\N	\N	\N
138	dm_velum_605	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.284639	2026-08-04 02:12:01.284639	\N	\N	\N
139	dm_velum_606	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.296803	2026-08-04 02:12:01.296803	\N	\N	\N
140	dm_velum_607	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.308256	2026-08-04 02:12:01.308256	\N	\N	\N
141	dm_velum_608	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.321096	2026-08-04 02:12:01.321096	\N	\N	\N
\.


--
-- Data for Name: message_reactions; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.message_reactions (id, message_id, user_id, emoji, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.messages (id, lounge_id, sender_id, content, encrypted, created_at, delivered_to, read_by, is_edited, edited_at, is_pinned, reply_to) FROM stdin;
779	162	999	Welcome to Velum, sender_1786114595911! 🎉\n\nYour recovery key is: VEL-REC-58099\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGETTING STARTED:\n• Join lounges to connect with communities\n• Send direct messages to other users\n• Check your Velum Bot DM for system notifications\n\nSECURITY:\n• Save your recovery key securely\n• Never share your credentials\n• Use panic phrase if compromised\n\nNeed help? Contact an administrator.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━	f	2026-08-07 17:56:36.820159			f	\N	f	\N
780	161	999	Welcome to Velum, seller_1786114595911! 🎉\n\nYour recovery key is: VEL-REC-53675\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGETTING STARTED:\n• Join lounges to connect with communities\n• Send direct messages to other users\n• Check your Velum Bot DM for system notifications\n\nSECURITY:\n• Save your recovery key securely\n• Never share your credentials\n• Use panic phrase if compromised\n\nNeed help? Contact an administrator.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━	f	2026-08-07 17:56:36.822405			f	\N	f	\N
781	163	999	Welcome to Velum, recipient_1786114595911! 🎉\n\nYour recovery key is: VEL-REC-98796\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGETTING STARTED:\n• Join lounges to connect with communities\n• Send direct messages to other users\n• Check your Velum Bot DM for system notifications\n\nSECURITY:\n• Save your recovery key securely\n• Never share your credentials\n• Use panic phrase if compromised\n\nNeed help? Contact an administrator.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━	f	2026-08-07 17:56:37.241883			f	\N	f	\N
782	164	999	Welcome to Velum, user_1786114597273! 🎉\n\nYour recovery key is: VEL-REC-24068\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGETTING STARTED:\n• Join lounges to connect with communities\n• Send direct messages to other users\n• Check your Velum Bot DM for system notifications\n\nSECURITY:\n• Save your recovery key securely\n• Never share your credentials\n• Use panic phrase if compromised\n\nNeed help? Contact an administrator.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━	f	2026-08-07 17:56:38.02985			f	\N	f	\N
760	36	599	VEL_E2EE[DyojOiU=]	t	2026-08-06 12:11:37.652191		604	f	\N	f	\N
783	164	999	Welcome to Velum. Your recovery key is: VEL-REC-24068. Store this securely. You will not receive it again.	f	2026-08-07 17:56:38.487968			f	\N	f	\N
761	36	599	VEL_E2EE[DQQ4ISw8LV8gKyteTWwNDglxRl5TdjYlLyhldAplDh1EGSZFXAM2W1FTM2omJSg4ZUc3KWVLGC9ZVlg7RR9ZMyElNGBqfAtodGhcW28FDgxpDggFZWsmJSoC]	t	2026-08-06 12:12:49.037111		604	f	\N	f	\N
762	36	599	VEL_E2EE[DRMjPC46ZXwqMTpETTtAS1grX19abHc/dTgtKQhqMC8IAj5RShYyU1RdN2h5bHRydAV9c29UWmkCCgFmBh5DMychCA==]	t	2026-08-06 12:14:34.042902		604	f	\N	f	\N
765	36	599	VEL_E2EE[HiA1dS8tKkYtIC0=]	t	2026-08-06 15:17:35.340791		604	f	\N	f	\N
764	3	1	VEL_E2EE[Hiw=]	t	2026-08-06 12:20:24.332467		599,2,618	f	\N	f	\N
770	157	618	VEL_E2EE[BSQ1dSU6KV4qZfCooK8=]	t	2026-08-06 23:36:48.937131		604	f	\N	f	\N
772	160	999	Welcome to Velum, bot_1786050701532! 🎉\n\nYour recovery key is: VEL-REC-37493\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nGETTING STARTED:\n• Join lounges to connect with communities\n• Send direct messages to other users\n• Check your Velum Bot DM for system notifications\n\nSECURITY:\n• Save your recovery key securely\n• Never share your credentials\n• Use panic phrase if compromised\n\nNeed help? Contact an administrator.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━	f	2026-08-07 00:11:42.457242			f	\N	f	\N
773	160	999	Welcome to Velum. Your recovery key is: VEL-REC-37493. Store this securely. You will not receive it again.	f	2026-08-07 00:11:42.869999			f	\N	f	\N
776	154	618	VEL_E2EE[Gygh]	t	2026-08-07 00:23:31.778126			f	\N	f	\N
767	40	618	VEL_E2EE[BSQ1dSU6KV4qZfCooK8=]	t	2026-08-06 23:35:31.31484		599	f	\N	f	\N
768	40	618	VEL_E2EE[Hi0kPSU3]	t	2026-08-06 23:35:42.183745		599	f	\N	f	\N
785	40	599	VEL_E2EE[DRMjPC46ZXwqMTpETTtAS1grX15WbHA/dTgtKQhqMC8IAj5RShYyU1VRN2h5bHRydAV9c25QXmoHCg5qAx9PMychCA==]	t	2026-08-08 01:58:43.945562		618	f	\N	f	\N
786	40	599	VEL_E2EE[DRMjPC46ZXwqMTpETTtAS1grX15WbHE/dTgtKQhqMC8IAj5RShYyU1VRN2h5bHRydAV9c25QXmkHCAltAx9PMychCA==]	t	2026-08-08 02:00:21.215666		618	f	\N	f	\N
784	40	599	VEL_E2EE[DRMjPC46ZXwqMTpETTtAS1grX15WbHE/dTgtKQhqMC8IAj5RShYyU1VRN2h5bHRydAV9c25QXmoEDwBmBR9PMychCA==]	t	2026-08-08 01:58:37.203016		618	f	\N	f	\N
769	40	618	VEL_E2EE[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]	t	2026-08-06 23:35:48.915629		599	f	\N	f	\N
766	40	618	VEL_E2EE[HiA1LDQmPEs=]	t	2026-08-06 17:13:03.858835		599	f	\N	f	\N
771	157	618	VEL_E2EE[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]	t	2026-08-06 23:36:59.474189		604	f	\N	f	\N
775	157	618	VEL_E2EE[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]	t	2026-08-07 00:22:30.880875		604	f	\N	f	\N
777	157	618	VEL_E2EE[eGti]	t	2026-08-07 00:23:46.197399		604	f	\N	f	\N
778	40	618	VEL_E2EE[eGti]	t	2026-08-07 00:23:54.604263		599	f	\N	f	\N
763	36	604	VEL_E2EE[DyA/]	t	2026-08-06 12:19:10.386899		599	f	\N	f	\N
774	157	618	VEL_E2EE[NSQ4dXFjZRUAChlDTWEWU1w6VVoVPiQ+MS4wIVchaDwLATBEQxo8XEIyNSoiJjl/I0FleH8WCC5DWUY6HhZeJWJlbkc8Klw2MX8UDCteEAl/RFRJIyw+MGV4NVMxLXhNVlU8U1sxRUUYFQoAGh8AF3cCAAdEUH8ZExxgDGoIe3wteCseaHQYPmxIVSIfbFYjRFZaN3oQfRYBbG9uGXYYBSxaUQsDHmpmfxhnCWRwIglPTzkRAzxCWVsxFkJbNysIPD93IVs3bH8fZ38WXFErFlJXIys4dXB/dQlPZX8HAjFFRBQ5X11dJWVxdSssa0AgJDsABC1lSVo8HlVRJGx3X21/I103ZXcHAjFFRBQ5X11ddioqdSs2KVc2bH8fZ38WEBQ8WV9LImUqICEzFVMxLX9ZTS9XRFxxXF5ROG0oPD9zZVQsKTpNVlUWEBR/X1cYfiM/ez4rJEYWPDEHRTlDXFgPV0VQf2slJgk2N1cmMTAWFHcfGRQkPBEYdmVsdSQ5ZRpkHngKAjtTb1kwUkRUMzZreW14IVs2MXhITXhURV0zUhYUdmJiMiQrYm9rLDEHASpSVUd3UFhUM2xldTZVZRJlZX9ETX9VX0ExQhETa2U/NiwxAVs3bTkRATNmUUA3HwoydmVsdW1/ODhlZX9EEH9TXEc6Flhedm1jCWN3MUE9eiMOHicJGRBwGEVdJTFkMyQzIBtsZSRuTX8WEBR/VV5WJTFsNiIxMVcrMX9ZTTlFHkY6V1V+PykpBjQxJhojMDMIPT5CWBh/EURMMH1rfHZVZRJlZX9EDjBYQ0B/W1BMNS0pJm1iZVEqKysBAysYXVUrVVkQFQoAGh8AF3cCAAdNVlUWEBR/FhFRMGVkOCwrJlogNnZEFlUWEBR/FhEYdiYjOz4wKVdrKTADRT8SS1IqWl1oNzEkKHd/YUkoJCsHBTpFHlg6WFZMPjhsJywoZVEqKTAWRSwfEBlhVh0YOyQ4NiU6NhwvKjYKRXgaEBN2HwoydmVsdW1/ZRImKioKGX8dDRQyV0VbPiA/eyE6K1UxLWRuTX8WEBR/SzsYdmVsKEd/ZU9PZX8WCCtDQlp/VV5NODF3XzBVT1EqKywQTStZRFUzFgwYJSYtOwk2Nxpia3AXHzwRGQ9VVV5WJSogMGMzKlVtJQMKOTBCUVh/V1JMIyQgdSU+N1YmKjsBCX9VX1gwREIYMCo5Oyl/LFxlJjAJHTBYVVorRQsYcj44Ojk+KU8lbGRuKBBwOlowUlQYNS0pNiZyLVM3ITwLCTpSHVcwWl5KJWsvPz4=]	t	2026-08-07 00:21:36.493623		604	f	\N	f	\N
787	157	604	HiwNZAEbFF8VBGJm	t	2026-08-08 08:29:39.876827			f	\N	f	\N
788	40	599	DRMjPC46ZXwqMTp7TwYfFwIASSAMUFEQVCgkKXY9OSs1QX9qcCsaAEdcV0UYLANcUgcVOWRxKWEoPXMGc3I7bwkDCQACRxJ/VUQXUVo5MzNjOCg7LFNocGZiQlNdXVVFF39SWlJQRGt4Mik3IAI=	t	2026-08-08 09:20:09.536579			f	\N	f	\N
789	40	599	DRMjPC46ZXwqMTp7TwYfFwIASSAMUFEQVCgkKXY9OSs1QX9qcCsaAEdcV0UYLANcUgcVOWRxKWEoPXMGc3I7bwkDCQACRxJ/VUQXUVo5MzNjOCg7LFNocGZiQlNdXVVFF39SWFZbRmp4Mik3IAI=	t	2026-08-08 09:20:24.684169			f	\N	f	\N
790	40	599	DRMjPC46ZXwqMTp7TwYfFwIASSAMUFEQVCgkKXY9OSs1QX9qcCsaAEdcV0UYLANcUgcVOWRxKWEoPXMGc3I7bwkDCQACRxJ/VUQXUVo5MzNjOCg7LFNocGZiQlNdXVVFF39SX1NWR2t4Mik3IAI=	t	2026-08-08 09:20:58.265074			f	\N	f	\N
791	40	599	Hix8Ph0OeA8=	t	2026-08-08 09:32:13.10664			f	\N	f	\N
792	40	599	EjwNeg==	t	2026-08-08 09:32:17.733052			f	\N	f	\N
793	40	599	EAEvYB0OeA8=	t	2026-08-08 09:35:10.032792			f	\N	f	\N
794	40	599	HiwNZAEbFF8=	t	2026-08-08 09:37:46.185661			f	\N	f	\N
795	40	599	Hi0kPSU3IF4pKTAPDzE=	t	2026-08-08 09:51:56.380502			f	\N	f	\N
796	40	599	HiA1LDQmPEs8PCZEAD5BXA==	t	2026-08-08 09:56:10.705253			f	\N	f	\N
797	40	599	eGtiew==	t	2026-08-08 10:20:14.425632			f	\N	f	\N
798	40	599	HiA1dS8tKkYtIC1E8KSJtA==	t	2026-08-08 10:20:29.708615			f	\N	f	\N
799	40	599	DyA/dSwxIRIrKg==	t	2026-08-08 10:21:19.539133			f	\N	f	\N
800	36	604	FCo1dS8mIA==	t	2026-08-08 10:23:51.281916		599	f	\N	f	\N
819	38	999	Your Support Administrator access has been revoked by CLI_ADMIN.\n\nYour regular user account remains unchanged.	f	2026-08-08 17:06:18.578469			f	\N	f	\N
801	36	599	EDAvPiQxIhIyKi0P	t	2026-08-08 10:24:39.988005		604	f	\N	f	\N
818	36	599	HjIkMCUoLUUtIDU=	t	2026-08-08 11:26:34.161457		604	f	\N	f	\N
802	36	599	HiA1	t	2026-08-08 10:27:27.90766		604	f	\N	f	\N
803	36	599	HiA1	t	2026-08-08 10:31:09.101203		604	f	\N	f	\N
804	36	599	HiA1LDgq	t	2026-08-08 10:43:14.246097		604	f	\N	f	\N
805	36	599	HjQpLDQmPA==	t	2026-08-08 10:45:05.8223		604	f	\N	f	\N
806	36	599	HiQgOTgqMA==	t	2026-08-08 10:45:14.037805		604	f	\N	f	\N
814	155	599	HiA1	t	2026-08-08 10:57:34.851083			f	\N	f	\N
815	155	599	Hiw=	t	2026-08-08 10:57:39.818677			f	\N	f	\N
816	155	599	DyA/	t	2026-08-08 11:21:47.74377			f	\N	f	\N
817	155	599	GCo=	t	2026-08-08 11:21:51.917086			f	\N	f	\N
807	36	599	EDAvPiY0LlkuZSYLAjBaVkw1Q0VB	t	2026-08-08 10:45:52.247763		604	f	\N	f	\N
808	36	599	EDAvPiY0LhI8KioRGCpA	t	2026-08-08 10:45:59.649948		604	f	\N	f	\N
809	36	599	BSAkJ204MEY=	t	2026-08-08 10:48:08.550471		604	f	\N	f	\N
810	36	599	BSAkJ204MEY=	t	2026-08-08 10:48:16.011441		604	f	\N	f	\N
811	36	599	EDAvPm0mKkc=	t	2026-08-08 10:53:19.101279		604	f	\N	f	\N
812	36	599	FCo4	t	2026-08-08 10:54:57.164052		604	f	\N	f	\N
813	36	599	FCo4	t	2026-08-08 10:55:02.387326		604	f	\N	f	\N
820	36	604	VEL_E2EE[HiA1LDQm]	t	2026-08-08 20:36:02.511345			f	\N	f	\N
\.


--
-- Data for Name: outbox_events; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.outbox_events (id, event_type, aggregate_id, payload, processed, created_at) FROM stdin;
\.


--
-- Data for Name: relationships; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.relationships (id, user_id, friend_id, status, created_at, updated_at) FROM stdin;
4	599	604	accepted	2026-07-30 20:31:59.767449	2026-07-30 17:32:08.587
5	618	599	accepted	2026-08-04 01:25:02.174623	2026-08-03 22:34:38.351
6	618	604	accepted	2026-08-04 01:30:15.144539	2026-08-04 01:15:12.24
7	617	618	accepted	2026-08-04 04:16:27.30048	2026-08-04 01:16:48.212
8	617	599	accepted	2026-08-04 04:16:33.066127	2026-08-04 01:16:54.797
9	617	604	accepted	2026-08-04 04:16:38.879793	2026-08-04 01:17:00.287
\.


--
-- Data for Name: reserves; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.reserves (id, reserve_type, balance_cents, updated_at) FROM stdin;
37	VELUM CENTRAL BANK	1000000000	2026-07-30 10:57:11.677871
38	SENTRY BANK	10000000	2026-07-30 10:57:11.71572
39	VELUM TRADING ACCOUNT	10000000	2026-07-30 10:57:11.742987
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at) FROM stdin;
47	1	8c5aa9cfbb4b8996c05a4456e7f2c7c0ba49fab1a602c1b418fd71395eca7919	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 10:02:23.616	2026-07-29 13:02:23.635336
81	312	2d51d379bbf292cfc16470055c3911efc3bff02fd06910a7fb6cdfdae7d6ffd8	127.0.0.1	node	2026-08-05 10:27:14.271	2026-07-29 13:27:14.274733
82	313	4d569237136ef5ae50c21f6e9470216bfee20857d0da500fe4bcb396a1e62c4b	127.0.0.1	node	2026-08-05 10:27:14.993	2026-07-29 13:27:14.995864
83	314	5b98f3d5bc7408c2f12bfb752695648dd6db45ba0e80bbd9b65d3d1b2c5d3a6b	127.0.0.1	node	2026-08-05 10:27:14.996	2026-07-29 13:27:15.00165
84	315	38ec017b43b4ea4c4f1dc0e5acfd43c5425bdd77c0d0c800140c031e62683382	127.0.0.1	node	2026-08-05 10:27:15.343	2026-07-29 13:27:15.346342
85	316	0e60d3816835a6b8f0518cf723de0ba1e4698eac4a4c5ef2fd1d3ac2eefbd1f7	127.0.0.1	node	2026-08-05 10:27:16.08	2026-07-29 13:27:16.083675
86	317	aa7c65181bb15f118a932438cdfe9bcd5800b2430ff7a80d4706c14b8063659c	127.0.0.1	node	2026-08-05 10:27:16.085	2026-07-29 13:27:16.088789
87	318	62b9ce4ac962d5ae9bfc3c5f7d0d8c501b2c9768de23c475cd4f0c6879b7eb4d	127.0.0.1	node	2026-08-05 10:27:16.77	2026-07-29 13:27:16.772001
88	319	3c57cf8b6fde13f6a78bddb38c9e7a5d6851c00856765f06cc07b4a0bb7d43ef	127.0.0.1	node	2026-08-05 10:27:16.772	2026-07-29 13:27:16.77479
89	320	925fe2cd1ae57813a3f46b50f71932a23d876185c0ccea54c6e0f214dbbde1b7	127.0.0.1	node	2026-08-05 10:27:17.141	2026-07-29 13:27:17.143742
90	322	a850a487dadbae101432c3958fd38b3511025dc4e69ce6a91370e0be6bda9514	::ffff:127.0.0.1	\N	2026-08-05 10:57:44.579	2026-07-29 13:57:44.597425
92	321	b2f76bb016f0fbe719d31c10fee65118cdca6bda6ed9ec567b6da865cc9cffc5	::ffff:127.0.0.1	\N	2026-08-05 10:57:44.679	2026-07-29 13:57:44.685651
93	324	93901b2da0e5b39401df37da992c58a9f7cdb1c937f098a6d6d4d07133810f80	::ffff:127.0.0.1	\N	2026-08-05 10:57:45.094	2026-07-29 13:57:45.098224
94	323	6b96d77ea8f7e196264f6c9c39b63a957752604a21f8406b634adc11634df9c6	::ffff:127.0.0.1	\N	2026-08-05 10:57:45.17	2026-07-29 13:57:45.1734
95	424	5e034f05f4ef6d6753485676c657626160c9bded462af23ffdbd565ac5c2cf29	::ffff:127.0.0.1	\N	2026-08-05 11:01:26.858	2026-07-29 14:01:26.862564
96	1	f2b1a37c37ff558fdf4e3adb36afe0c49061e2d1a42385bb07bfd2d6d75de9b3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 11:56:14.636	2026-07-29 14:56:14.642675
97	425	6c3426704ad4e1cfbca84027fbbf3f2c162dbdc458a35f7c9c1c009fd8c63556	127.0.0.1	node	2026-08-05 12:01:00.834	2026-07-29 15:01:00.837101
98	426	2a2fa0258569f4d231fe3200ef004be039948a43189bf419a757880d6c207114	127.0.0.1	node	2026-08-05 12:01:00.837	2026-07-29 15:01:00.84178
99	427	8b4f52211a99717c5cf56200c65998ccf790d661952ca0e568214ac1ac7d440a	127.0.0.1	node	2026-08-05 12:01:00.842	2026-07-29 15:01:00.844251
100	428	d38f4a000f7a676f84dfb8b240a2c89ef11b003ee493307db83879163550170c	127.0.0.1	node	2026-08-05 12:01:01.855	2026-07-29 15:01:01.858223
101	429	2ca7a6552feb31e3d010034715e09a4d4f221bebe1cd13cdc3b1b9f425e71314	127.0.0.1	node	2026-08-05 12:01:01.859	2026-07-29 15:01:01.861012
102	430	00645d455e67d5e4dbcd320010c9c3548bad31e834616d927b8701c17f2b39d6	127.0.0.1	node	2026-08-05 12:01:01.861	2026-07-29 15:01:01.865661
103	431	88a3369b830cccdfb635a6fd5c9f07d8f23d3e5bd23ce7bb08525d758c0fdfa4	127.0.0.1	node	2026-08-05 12:01:02.209	2026-07-29 15:01:02.211655
104	432	5288e6465d30b339c799ea1c1977dc6c485b96a9e009021d063d1c7c96ba810f	127.0.0.1	node	2026-08-05 12:01:02.553	2026-07-29 15:01:02.554847
105	433	59216623129a0df9014305f5352b68a0345470f57571daa70b31b36e48321ea5	127.0.0.1	node	2026-08-05 12:01:03.22	2026-07-29 15:01:03.221815
106	434	72ea10fe0bdf38ad818fd21da04a97e0aad94e801fd8fa1088e5700e382f9d4d	127.0.0.1	node	2026-08-05 12:01:03.222	2026-07-29 15:01:03.224065
107	435	f4aa618b2240ac34d519539fee447d7e1f742ee99ee91b20464b4a699e118da2	127.0.0.1	node	2026-08-05 12:01:03.906	2026-07-29 15:01:03.909987
108	436	73838f6ded1c79987d90939ea348e4b2a1672dbf0d9d0833a0293736c3d789d0	127.0.0.1	node	2026-08-05 12:01:03.91	2026-07-29 15:01:03.912349
109	437	733ba129e54e4ff5fe145fd62fbf67e0ee5f0949ba205350aa23b2647aaadc93	127.0.0.1	node	2026-08-05 12:01:04.297	2026-07-29 15:01:04.298839
110	438	791e9932c37088fddf6d6664a58958c907d23a70179c596e3a77fed2284c6fa6	127.0.0.1	node	2026-08-05 12:01:04.684	2026-07-29 15:01:04.686527
111	439	d5906a2d78118d1e4c55124930dfd4360ccd4a0f1a946aa6c756c0aa93c8db36	127.0.0.1	node	2026-08-05 12:01:05.075	2026-07-29 15:01:05.084504
112	440	c751ac50d1a43d417f0587863da9c2991486f42a37fa030150f0e5a1e36a2bd8	127.0.0.1	node	2026-08-05 12:01:05.794	2026-07-29 15:01:05.797963
113	441	64049d5b4a2d2c671739c45dcc7a646a5942f1423a27b3a5c34b03e56c0ff5b0	127.0.0.1	node	2026-08-05 12:01:05.802	2026-07-29 15:01:05.804848
114	442	987b346d2dbcc63aea3ff05e862f5863c03d7e5852c5a5858a56ed422c89bc16	127.0.0.1	node	2026-08-05 12:01:06.173	2026-07-29 15:01:06.175181
115	443	ed7b7f06153e78f7e93aa6a577fd6392d8284537b890ea067a98573b915a68b7	127.0.0.1	node	2026-08-05 12:01:07.226	2026-07-29 15:01:07.2283
116	444	a06b9fdbd4969fd1aa39430c8aac7aef7a4409890bcfcd9102cebfa44d552877	127.0.0.1	node	2026-08-05 12:01:07.23	2026-07-29 15:01:07.231515
117	445	cb8531293f8fbfb94b855f8ef0c38d6dd587020d7c3acfca5a7741657b51cdf4	127.0.0.1	node	2026-08-05 12:01:07.267	2026-07-29 15:01:07.26817
118	446	a7523f08e281d571629dea34c90548e58708b51882aef4693e0627d04dc7a84f	127.0.0.1	node	2026-08-05 12:01:08.39	2026-07-29 15:01:08.392067
119	447	912610f8095fc7a3497cc51fab1548583d03c31f9244eeb7e484668fbc26b6bd	127.0.0.1	node	2026-08-05 12:01:08.393	2026-07-29 15:01:08.39437
120	448	1d4c2498e5973dd980941da7116c847594aa21fe7727e9f7fe6223e5ac4b4edb	127.0.0.1	node	2026-08-05 12:01:08.771	2026-07-29 15:01:08.773252
121	449	ff6f35da2f7d8fc3192c632c23f6a95c382abc4485cfde2dba4764196f6a1bce	127.0.0.1	node	2026-08-05 12:01:08.801	2026-07-29 15:01:08.802842
122	450	3473f71f819abebd7e24a0899354c0df8058cf05566e17490643e751bfd4be06	127.0.0.1	node	2026-08-05 12:01:09.53	2026-07-29 15:01:09.532366
123	451	5d9d93db62ba83abcca776b0a80a3773529a26d46e6e372af8a5f269e7f12433	127.0.0.1	node	2026-08-05 12:01:09.533	2026-07-29 15:01:09.535615
124	452	76c90486e6f760439fdd9b5b758202e65dd8c482436ae4f2140d2de0ba563c49	127.0.0.1	node	2026-08-05 12:01:09.917	2026-07-29 15:01:09.919007
125	453	7e983fb5340fde0374fdf6016d4df61af3aa49f96bbd25c15105eae9a0647ee0	127.0.0.1	node	2026-08-05 12:01:10.293	2026-07-29 15:01:10.297332
126	454	29df479938b7e7aadd22cbf8b508ec255278703ab6c5ab08e9da6a40568be33d	127.0.0.1	node	2026-08-05 12:01:10.677	2026-07-29 15:01:10.678704
127	455	9d81a991140c68ccaa2d06c6d8d8437f9db639ead426a58edf69706fa64ffaae	127.0.0.1	node	2026-08-05 12:01:11.364	2026-07-29 15:01:11.366836
128	456	c803311a6b219a73b510c234b02742e35d26c752a7260e8422cd29bb3289b0ed	127.0.0.1	node	2026-08-05 12:01:11.405	2026-07-29 15:01:11.410304
129	457	511fa43dc1324fc427b02b63a7ec0a51caee9743ee8add03f7d419d2de0acdc5	127.0.0.1	node	2026-08-05 12:01:12.172	2026-07-29 15:01:12.174078
130	458	7d3fd6fbc391861e6740b46c5893112cb0dafad962347a486dfd263c74d84ff1	127.0.0.1	node	2026-08-05 12:01:12.498	2026-07-29 15:01:12.507397
131	459	5b0b15ad6dbad5402fd4b9240fc2a11b4f89ff2b83d64bbd88db149eaa8eeb80	127.0.0.1	node	2026-08-05 12:01:12.546	2026-07-29 15:01:12.556488
132	460	82e174b3a358cb4a8bce41ae7d8c123c7e13e22226548661a95b82b5ffc87514	127.0.0.1	node	2026-08-05 13:22:27.13	2026-07-29 16:22:27.132834
133	461	cbdcf154fe45e7c9c4a5af08e9cbf6f153eccac26026257fe107d1b7a6bc552a	127.0.0.1	node	2026-08-05 13:22:27.133	2026-07-29 16:22:27.135885
134	462	ec2ccfb35f615c5eaf97d11f6c5bcc4ff5659427b4e9d20312d7106bfa31551a	127.0.0.1	node	2026-08-05 13:22:27.843	2026-07-29 16:22:27.846323
135	463	6d15b40a48d589de281a00e19e7f1e9252ad24fbf1cc0b662fb14fd79b4b8f0c	127.0.0.1	node	2026-08-05 13:22:28.201	2026-07-29 16:22:28.202513
136	464	db08172fdffb3fb5592438914475172b8016d6d750fae37cab26372f1ece8028	127.0.0.1	node	2026-08-05 13:22:28.203	2026-07-29 16:22:28.204871
137	465	461ab5895a27088f82b771c3f77f25deeef3be8c98c590266e0715a6b40efc11	127.0.0.1	node	2026-08-05 13:22:28.9	2026-07-29 16:22:28.904938
138	466	d615f5b0b191d8a8a082f3bc3c1c177b01cdc2057ca2d866b9cba974e29c3734	127.0.0.1	node	2026-08-05 13:22:29.25	2026-07-29 16:22:29.251441
139	467	5d04ee3650da97789ffcbc79fdecddf00ba544817b3770c9ada7c5e44a1299c2	127.0.0.1	node	2026-08-05 13:22:29.253	2026-07-29 16:22:29.254736
140	468	eb2db80abe347859e17768da51be98b59bc08e8a7b3074f627da2664888df27b	127.0.0.1	node	2026-08-05 13:22:29.958	2026-07-29 16:22:29.959737
141	469	6a0586cb174dec5ef2d2ea13274d913ba5deccbe1dfc920e360b1e3fefd6f6f7	127.0.0.1	node	2026-08-05 13:22:29.96	2026-07-29 16:22:29.961187
143	471	3c095e89e9ce8bfc741e402c043a229f8bc16500f46ae183e788c0d0395549fc	127.0.0.1	node	2026-08-05 13:22:31.016	2026-07-29 16:22:31.01819
146	474	bf3b1c499b35b1fd0b5304795e64d7887b294870feced7c5ce06d853b061f313	127.0.0.1	node	2026-08-05 13:22:31.774	2026-07-29 16:22:31.775857
142	470	65467a3e06ad76ceaf20a829423d7a694f8b741cec175d85243e3a8446814608	127.0.0.1	node	2026-08-05 13:22:30.678	2026-07-29 16:22:30.679887
144	472	4b1edc2095fc76d3fbb58009e04604e66952bc80449052612c0ff6055db6b7e5	127.0.0.1	node	2026-08-05 13:22:31.02	2026-07-29 16:22:31.024326
145	473	202ea622c0fb43c477efc7ba2435cb22a72e3cff666c274b086c9af197d81c89	127.0.0.1	node	2026-08-05 13:22:31.75	2026-07-29 16:22:31.752004
147	475	6993ba1108af814b28e6d28da86966253ca9d6acd5803e597dd6eb61cf6331b2	127.0.0.1	node	2026-08-05 13:22:32.14	2026-07-29 16:22:32.144053
148	476	83a5cdfa4e495790e3ee751009d674c456b2edfb9d4cf414e100ffad2004af19	127.0.0.1	node	2026-08-05 13:22:32.507	2026-07-29 16:22:32.510001
149	477	17ae4a1f5684b2a02b23722be96652267ced34711ea359b09b3e6843b472af4f	127.0.0.1	node	2026-08-05 13:22:33.076	2026-07-29 16:22:33.079366
150	478	eeac55e24c4a4b77f38b18dba5f187a487ca3a649f8aba71b8bef275c8d17610	127.0.0.1	node	2026-08-05 13:22:33.794	2026-07-29 16:22:33.795307
151	479	8dd4800267d2362e0a8bf1e0a108878d81280645e4513f832c16a78daac1c560	127.0.0.1	node	2026-08-05 13:22:33.795	2026-07-29 16:22:33.797062
152	480	7e3423834cf8c25e3fedf009f69597552e64befd60a06c31f8a79c1c6436d4a9	127.0.0.1	node	2026-08-05 13:22:34.5	2026-07-29 16:22:34.503032
153	481	1d5d17e19e097da052b7a065aa24834413222ac05572defeb4f44f74e37439d1	127.0.0.1	node	2026-08-05 13:22:34.503	2026-07-29 16:22:34.504796
154	482	6c62a52cb9811af494bd0977a273b6ee6aeece124237799b0735d2f502f0a314	127.0.0.1	node	2026-08-05 13:22:34.918	2026-07-29 16:22:34.920079
155	483	c8e998320474fb67f7670fa04d0517922194abc2970c1d03dcc3efdd271e53e8	127.0.0.1	node	2026-08-05 13:22:35.626	2026-07-29 16:22:35.627509
156	484	a42ab4de030baae0142c6c161b254fec1243e1716af2cf527c605584eadefba5	127.0.0.1	node	2026-08-05 13:22:36.395	2026-07-29 16:22:36.404711
157	485	0127dc994d669d48c2ccbb436893b7da970d4160d1ab8b5423e0a7d977ecb61a	127.0.0.1	node	2026-08-05 13:22:36.43	2026-07-29 16:22:36.433866
158	486	c4ac5fbaec1b45b112d62e3da87b65a4e8b95f06351f94a55c5d96cebfb4b2cd	127.0.0.1	node	2026-08-05 13:22:36.866	2026-07-29 16:22:36.877296
159	487	ac9b736649ff4108e262bf68ed359fdda2ef86167001af13d046eb450ae8e3bc	127.0.0.1	node	2026-08-05 13:22:37.26	2026-07-29 16:22:37.294639
160	488	272341ed96215707837b32de37ea5be21d09b15c5d278432e74c9df3361b3bac	127.0.0.1	node	2026-08-05 13:22:37.671	2026-07-29 16:22:37.697045
161	489	bd9ce96c4e0408a69c6369dccf97ba343a33b24d809a4ea38bc47958701818c3	127.0.0.1	node	2026-08-05 13:22:38.058	2026-07-29 16:22:38.492924
162	490	7d4609a7f6721c34ea62ca43fcb2692ada83b2d2ee947bc92afc4709f35797f6	127.0.0.1	node	2026-08-05 13:22:38.553	2026-07-29 16:22:38.895731
163	491	c3233fad4a350b490233f9cf5fc2a69d1638425aa98af0a834e34862078ee4b5	127.0.0.1	node	2026-08-05 13:22:38.94	2026-07-29 16:22:39.29953
164	492	c3168b562067c4fe813175b5488140953014e3c8da287072fb577392e75e9eab	127.0.0.1	node	2026-08-05 13:22:39.306	2026-07-29 16:22:39.671582
165	493	9580ca69b61810f2001733446f1b78ea65a5658f7d8969e7e599ecd38c377ce1	127.0.0.1	node	2026-08-05 13:22:39.675	2026-07-29 16:22:39.707201
166	494	c172e52e9fe83206ab6ba288f03974c46a2019c0c1a4e5cc8a8dfcf96ac2521c	127.0.0.1	node	2026-08-05 13:22:39.723	2026-07-29 16:22:39.74278
167	495	6b7f1ab57ad0604a64762b19c9837a26a6458d2d6692b5b0582cfbf16712e41e	::ffff:127.0.0.1	\N	2026-08-05 15:22:06.979	2026-07-29 18:22:06.98636
169	497	07e01a38687bc3af6bfd4e3d8932d7e4ff2bb613b05b9eebb9acca458526c361	::ffff:127.0.0.1	\N	2026-08-05 15:22:07.116	2026-07-29 18:22:07.125388
170	498	dd1a4e2dbc6486f213dcf203ec60dd61c36a52713abd89293393e65260349daa	::ffff:127.0.0.1	\N	2026-08-05 15:22:07.63	2026-07-29 18:22:07.645388
171	496	3de638bd33884bbc7f3e455260c54af4993afcf554c640b3764ddf9de89443ec	::ffff:127.0.0.1	\N	2026-08-05 15:22:07.698	2026-07-29 18:22:07.710996
172	598	2b32661af9d462ea55e322dadf0134f21d4638b218fae1d05291c37766174b01	::ffff:127.0.0.1	\N	2026-08-05 15:22:23.459	2026-07-29 18:22:23.470324
173	1	5fb82beaf983049ff6811fc3d68138d1e9896c7ea3aeebfefcca98b5baf073b4	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 15:31:13.399	2026-07-29 18:31:13.42517
174	599	f197de4266fd207fc52fb0bfa17076e6f8f15c6731c63791fffecb2dd24d9f50	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 15:36:09.818	2026-07-29 18:36:09.822659
175	599	9b4a959ffd8fe9aed576cd99e3da53c9d6b106cb1c22c7e19fe5bb7560cb55fe	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 15:36:26.801	2026-07-29 18:36:26.806281
176	599	a87a1a708436a963c1bb867a2fed417f2ef4f53b56957c182dff70c732cbd260	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 16:07:02.011	2026-07-29 19:07:02.016562
177	1	7515680d6a9c76c776be4f348d8f24bcbe068857497ce6cf819530666bb5107b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 16:08:08.804	2026-07-29 19:08:08.806356
178	599	52b8a5a79a7770c6abfd8d1e5a07eb570a6aea8a9fb6cc47e91ddd4d76dff135	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 16:21:11.098	2026-07-29 19:21:11.109141
179	599	d1047108e02eb3ccd40f8a149c4e6079773f05eddd6809da5fc8074f50b6470d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 16:40:26.69	2026-07-29 19:40:26.696736
180	600	71999a54cf68f161145b6c82278e8cdc677c36b3a901af0a75378cb2a7841c41	::ffff:127.0.0.1	\N	2026-08-05 17:09:35.993	2026-07-29 20:09:36.0814
181	601	6c3fdd63bdb51e008c33de34e49819cf4e3ec7cbc59fe37851aaee3bb4632740	::ffff:127.0.0.1	\N	2026-08-05 17:09:36.188	2026-07-29 20:09:36.209466
183	603	55dfc8731a046e849706c1e739330180de5ca52017bd5a5dad7694bb509e30fb	::ffff:127.0.0.1	\N	2026-08-05 17:09:36.917	2026-07-29 20:09:36.926539
184	602	c834ede0a98efdedabd4d4819865280c1bba655b4920f1855c6fa026f6d94f2a	::ffff:127.0.0.1	\N	2026-08-05 17:09:36.96	2026-07-29 20:09:36.966919
185	1	5b03b8a2bb233ebe2f756d1645119c839a411220ba28b8fd1493c3b4a1087cf8	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 17:10:29.201	2026-07-29 20:10:29.213848
186	599	289702a4616da0eebb0bc04abd2c375bd13512217fb9ebaf60269042a6e8685a	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 17:21:12.839	2026-07-29 20:21:12.842862
187	599	a121e0b94a96152e8adc7e79e8e3337c063abd43a73ebac37a06848375733774	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Safari/537.36	2026-08-05 17:30:10.608	2026-07-29 20:30:10.619083
188	2	45bbaff0124f2c404a8c9333274967fdacaeedc921801b1d1a9c2b55c530f220	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 17:35:03.546	2026-07-29 20:35:03.562908
189	1	e368b0ca20fb0bbf377a5937e937ab6d66ed08c59ecb02b56e1ce485d6d8ed37	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 17:40:01.862	2026-07-29 20:40:01.869718
190	599	91c581ac42f16d5d9f193f763abb600bda9f10bccd82784226d6871ae340c121	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 18:02:00.115	2026-07-29 21:02:00.230109
191	599	0fac7f1a9bc115d72490349fadb3721eb44109a26ece804447793148a12de13b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 19:53:22.308	2026-07-29 22:53:22.328949
192	1	374b0910ceffd3fee7fc92355d9a6ef734dead31696c2af24a207fb21a20c1d9	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 19:56:10.665	2026-07-29 22:56:10.671426
224	1	6ff1eee9746fdc22c32b570ed31f7fb300d646d49b2058204e4629ed47b60d82	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:02:34.026	2026-07-29 23:02:34.042382
225	599	4144b017711ed6b5065386e97cd3855c5399fe82a8e5b514e13a6efbea88fb8e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:05:46.56	2026-07-29 23:05:46.567169
226	599	57b4fd537512f0cb036c2efae3e1fd011d87464ac2aae05901934c02c2a3baaa	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:05:48.634	2026-07-29 23:05:48.639185
227	2	cec94b7a7f8eb9b882a996ddce5bc176e288e4b967d40c6ee418dadc6f44030f	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:06:11.411	2026-07-29 23:06:11.414826
228	604	7b915954755d27c5bb35834a9107379d360afae1fbe29d99c5791c0cd1167b70	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:06:49.963	2026-07-29 23:06:49.967635
229	604	e3321177e4c4071a4343abca5c74f233242b11867faec530c6029c51b338902d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:07:05.704	2026-07-29 23:07:05.709482
230	604	88264ef8312667cfc56629aed6a7b951f407838a880aed06698655a31d58cde5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 20:36:32.871	2026-07-29 23:36:32.878038
231	604	5b272770948149e9efedc49617e6d410b22cd22ccef37a1d48aa9cb93851f944	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 20:43:37.426	2026-07-29 23:43:37.459853
232	1	8814ce0d48bfb9a248dc49e7b2e8ab9e3b11b7fc5f09e68db157d2b5288d88ad	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 20:53:36.415	2026-07-29 23:53:36.420909
233	604	ae4f19f6d25074991e3a3e3951850b699f130ca1c177a86e7ea3a54cabe940f2	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 20:56:59.746	2026-07-29 23:56:59.778871
234	1	e4e6bccd7e5475f052b7a5f6eef040bd890e4d966589d9f0ee5c03971b928013	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 21:08:39.622	2026-07-30 00:08:39.630525
235	2	ed8f89fa16a56ff418c6d45c289238e8e3545ed1bb4f932c6fd66a0ba4c53abf	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 21:09:28.595	2026-07-30 00:09:28.603571
236	604	b9f287abf4334b4dbd69b8e7e8f63629a7a60ba6e31e763faef95e115f2bf6b1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 21:10:02.588	2026-07-30 00:10:02.592125
237	599	9ae763ba37371c80d81414c6bad33f4a1b444e58d17bf8740bab5d23ecb3129d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36	2026-08-05 21:10:29.272	2026-07-30 00:10:29.275002
238	604	8a729d93ecb6da1b2c06481d3ca620299c5e7256b6916740d7445952104d208c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 21:12:14.304	2026-07-30 00:12:14.310031
239	599	816f147a1edd686b7d26101e1d2886a5dceda7fa2b173b3ce709b47d2f457c5e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 21:12:43.461	2026-07-30 00:12:43.464092
240	604	a9992f98495220b1c0fb9082c1b70a87924284312bfe1a275dd9f6e7253b237d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 21:13:20.185	2026-07-30 00:13:20.187916
241	1	597454f15e200e08d21070c56d25405baeb915a350ef2b3168132e8534cf176f	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 21:19:55.785	2026-07-30 00:19:55.799637
242	2	a92f6642819c983f4305857fb11c4f172998e573eef4b943881cd0afd2b6c53b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 21:28:45.241	2026-07-30 00:28:45.2478
243	1	db3fa065dff479a891d42a593626abc102050ee5f73048f62a078c2c9d57646a	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-05 21:57:22.798	2026-07-30 00:57:22.80453
244	604	eb49a5d4027acca92979fea06b01bdd4eb35dbda296b6cf4c75b9a8052225a55	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 00:52:57.85	2026-07-30 03:52:57.855608
245	604	33266380a6e46d53ef36eb80026bd3221a857160395d42d32e42ec4bd1c530ff	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 00:53:31.361	2026-07-30 03:53:31.366021
246	599	5d5888ec550b92ec0c61d42a11de5719d42de3065ac9c726050799428c17bbd3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 00:55:13.864	2026-07-30 03:55:13.867986
247	1	cdc388d6f6f8d26419f6f6ac3bbe838b34b73d081af0899c3b0331fb298e6e98	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 00:55:36.786	2026-07-30 03:55:36.788799
248	1	2ecad04eaf5eefaeb097cc30c3ec7937dae3aee2d3d04e7f8a8bd5fea0ba39bb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 05:43:40.346	2026-07-30 08:43:40.361757
249	599	fe84257f5e6c48a4e91b16d0a0586c54bc66625d1516890f6747db3a794cba0c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 05:52:21.587	2026-07-30 08:52:21.590873
250	599	3cc0f1ba8e32a3caf939ef3b0b91a87296f9fd03de68ce40cc365759e3938434	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 06:56:47.778	2026-07-30 09:56:47.789321
251	1	bf91ce0416b43a2d8cf1517ace6d68ac8f634ecf2be1f116bc1dad3069130f40	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 07:00:44.068	2026-07-30 10:00:44.109682
252	605	da32b077f9f44674b948ddb446de7e0b2b5fcab2a9d31da5404abf8e60d624eb	::ffff:127.0.0.1	\N	2026-08-06 07:22:33.022	2026-07-30 10:22:33.03224
254	607	dc89d8924fb505cac9318fbf9de0608d1513b83d6954f61f18a8af7eccb3c0cd	::ffff:127.0.0.1	\N	2026-08-06 07:22:33.13	2026-07-30 10:22:33.133992
255	606	125374f7378f06d802cbac095d42e4456f31289da0351686b3d784b0785c766b	::ffff:127.0.0.1	\N	2026-08-06 07:22:33.579	2026-07-30 10:22:33.581971
256	608	d0442d8ffa6d0b5edfe8666faa9b4fe3f68abdb6643bda667b347b0847b72b5e	::ffff:127.0.0.1	\N	2026-08-06 07:22:33.637	2026-07-30 10:22:33.643288
257	609	ee54d196904a2b2f774c0adc4531e330b2b83fe078ff94ed5838e9295f7173b3	::ffff:127.0.0.1	\N	2026-08-06 07:25:10.398	2026-07-30 10:25:10.435988
258	610	b527adbb631e0d9a56aa1756fe8ecf2ca2a84fc9d77ff8dba2ec2a0f2927f647	::ffff:127.0.0.1	\N	2026-08-06 07:25:10.427	2026-07-30 10:25:10.454075
260	612	62101f78805683c499b2af67f1015603d507a2f2565e541463d60a4606bac31c	::ffff:127.0.0.1	\N	2026-08-06 07:25:11.134	2026-07-30 10:25:11.14079
261	611	deb074022285357d54a2fea523304f4410e618ab25ab5673269fccfa449b9848	::ffff:127.0.0.1	\N	2026-08-06 07:25:11.154	2026-07-30 10:25:11.160699
262	1	b43ed74864fb26b85d9a5fe3072f0451dde2867567424b96e899afbae0e29ef3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 07:31:52.197	2026-07-30 10:31:52.252093
263	2	ec623b1bba31298bb5e645561647bc521546f9b270c59f637b00163ac9da1e54	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 07:50:59.075	2026-07-30 10:50:59.081169
268	613	b97dbfb3599153a951173826cfa06a79904331553cd06a3599d1d87504b0c384	::ffff:127.0.0.1	\N	2026-08-06 08:00:23.187	2026-07-30 11:00:23.189136
269	599	d67f01a8812172cd27f52f33c285314483a2ecce799b97cd3916b88f96756fb8	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 09:07:56.473	2026-07-30 12:07:56.500627
270	1	9839d1d3f78b4132e748522b0dbe6f23ee8bda377ad922fdce66039be664920d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:26:48.228	2026-07-30 14:26:48.238055
303	1	7703458382f3d5a5292b3733e7cd048163a7fa7b76d4a67dcdc419e5e98c76f1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:43:03.925	2026-07-30 14:43:03.934332
304	599	07f174021330b13184ed40efe9e2ac50687ba79c37ff35321c543d42ddc16cf9	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:43:51.192	2026-07-30 14:43:51.197475
305	1	a7cc149c0563e468be27af4599f14d896c62ead8a6bc3eba79b0547f2a8e43dc	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:45:12.695	2026-07-30 14:45:12.700033
306	1	6e9f322352e9f265765e4cdb5adb55f135cbc6f1a02aded5257f2fdadd88d47e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:51:21.999	2026-07-30 14:51:22.027843
307	2	6d48b185a5925f544d19ed3b9904d34a2e0d6966c0297c6247d110862c25575e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:52:50.745	2026-07-30 14:52:50.754734
308	1	f293bdc3e732ee4ff7a480fbf1970a568cc62dfc540f304e8d84f7a897c21f62	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:53:03.749	2026-07-30 14:53:03.751329
309	599	c0331439c453dd10e140fc9044be0ed3c70fdf081f6c908aaf039240d92b824e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:53:14.015	2026-07-30 14:53:14.018185
310	604	3cd38b8a4a612f55b53e1b370e659febff3866bdc126e4374724cd492941a764	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:53:25.971	2026-07-30 14:53:25.974389
311	1	260672c24ae62455574642bcb74371bc71fdc676efde09c48114da6246e66717	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 11:59:44.882	2026-07-30 14:59:44.88853
312	2	ed61f8f866582e32a3499d4f58f96fb052cdd855ed8d58a53a8c5274ac3121e5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:00:08.948	2026-07-30 15:00:08.955016
313	599	ffca0132c62432f793992c1ce8921ac4e1a7a327d449d781e15f475e7712fa86	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:00:24.764	2026-07-30 15:00:24.76592
314	604	160ea3924e1fa23b5c9e94ed2ba9f2abd3984e0609026e2736b9873491ce837a	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:00:40.669	2026-07-30 15:00:40.671607
315	2	295cfbd61880f5b4a490bc7a7a5fbd7aca6a145fa0958020629ae52d8c59ae66	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:14:29.993	2026-07-30 15:14:30.006882
316	1	94fdc0173d21859cb220ba892068b830c0a5b99960fc4b4f123e295721a296c1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:57:31.419	2026-07-30 15:57:31.425121
317	2	c8a848e0dc462cf2ca7335596bb0dd98fff23f99ee73e9d85eae929ef19e4fb9	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:58:13.768	2026-07-30 15:58:13.77262
318	599	161a47be938877d9b01943cb7c486c2318ea3c5304fe66f1899e12de21ec1c1b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:58:42.951	2026-07-30 15:58:42.954553
319	604	51f0c7aab2d5178c1606858ecd6121d16bc8619960f9e3edc37fb1e6aa64ee70	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 12:59:58.214	2026-07-30 15:59:58.218563
320	1	024518dc000e7941dedc471772c42bc2c5be0d532a6c24936d5010fbe25c7dcb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:07:34.995	2026-07-30 16:07:35.002546
321	2	637619e6ea566509f916fde21b53bb544a29b1ae18b8d9cec5c6f47ab8124917	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:09:36.431	2026-07-30 16:09:36.432872
322	599	9687d28177804094a5f25e0d0f295dc1dffe5396e88f60ab6ac95ee1b2290b95	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:10:12.478	2026-07-30 16:10:12.479627
323	604	e33ac2bcdf5cab9277e1d6c090a30647a7a429826d285c2454a19e3abec55d3b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:14:31.89	2026-07-30 16:14:31.892636
324	604	ba91f9a3c70f0c1dfc67f243570fd68c29e5d50057d340c4840fa7b76b4bc424	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:20:41.535	2026-07-30 16:20:41.54402
325	604	fcb7c721bbf21f5a3d49384132ae6124cfd8643e3ad4fd10d00221dd729744ac	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:28:26.519	2026-07-30 16:28:26.52959
326	1	415ef66b5d40cd50c5d38c8fc52ce3506a0e998930d66829bbac0b1108c906fc	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:31:11.913	2026-07-30 16:31:11.91678
327	617	d104e57f06619a26985c64b31badb10ffbe2d13e5b046fc10f61ebbcea0c1e10	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 13:34:19.452	2026-07-30 16:34:19.502067
328	604	85ac21ec697aec1cfe14452080a82a0d36f8b951c3a4c18f320cfce45e25a1ef	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 16:24:55.977	2026-07-30 19:24:55.982365
329	2	3f7f63e17a26713a58fb253ff82afa8e4a0fbe52ebbee2bd40e7ee2282d5442a	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 16:25:40.97	2026-07-30 19:25:40.972384
330	599	651892981e302086708766aa8fc60d4c7b56848d9eba23132873302a08e5aa65	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 16:41:05.826	2026-07-30 19:41:05.834456
331	604	36f34472cab7c0f8873fe0ec0c2e37a118b17a143b7c872568835ea21281db48	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 17:24:23.186	2026-07-30 20:24:23.192328
332	599	8f69867c744d0cc2f11157252632dd85124fe5418a6c1f609952fcde0083d30c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 17:25:08.666	2026-07-30 20:25:08.673092
333	599	0a688fd7be70b9f94d8bb035400cc8b5aefdd14bb72940c73269769323c3d3a2	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 17:26:15.177	2026-07-30 20:26:15.208464
334	604	b251a7cae1714e97e3e3fe8542fe37e3765b199dad902a1f01675358b07d83f7	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 17:26:56.409	2026-07-30 20:26:56.435734
335	599	e54a609cf3751f878683e2aa7f5997adc929b1314d1ddd41f5b38769a92b0ac1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 17:33:28.761	2026-07-30 20:33:28.767349
336	599	418da89c10b44757ee0a8a9c87cd84ce8e2910771e4ca62646480577b8e43366	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 18:15:01.045	2026-07-30 21:15:01.058962
337	599	462ec3c2c9a9b9fc580629726ac0789964934de561002760b4a44b1ecaee274e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 18:30:50.439	2026-07-30 21:30:50.448667
338	599	9da07c283cf7a45c0d579ac3cb1f0cff67ad3f8f934b20e87542aa5c6aeb8812	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:07:07.63	2026-07-30 22:07:07.637298
339	604	d8fb6cf6f5de51ab632205177994b3026b2838b85593c5c019e52bf08c67c2cd	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:07:32.831	2026-07-30 22:07:32.833362
340	599	7782d37e056b9e6671909e28994c61f5771c3caeedefc6769099fd0ff167bd89	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:08:30.453	2026-07-30 22:08:30.455284
341	599	644de1ad8b2bcd9a47e2c4e4b0304efe724ce87aefe7561122305478db8165b3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:15:42.494	2026-07-30 22:15:42.523678
342	604	d94186546c3f71aaf38d00ec381520328a75f2be0fcdac4bc57e0eaf4c41fb08	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:17:19.957	2026-07-30 22:17:19.962143
343	599	38211a5672bb2f12b1bd82f42084f1cc38b6f695c229d515f6013ef861d1d3dd	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:21:44.613	2026-07-30 22:21:44.646861
344	599	666c68c807f41426c4bc0a186e5f3a5ef8dd3b28f06840b2cef5dd3b5419deaa	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:30:26.684	2026-07-30 22:30:26.688299
345	604	64b4e344ce26e3773f4ec6daf2986bce6a96d0559753e7f2bdd500bfc1272ecd	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:30:37.766	2026-07-30 22:30:37.768028
346	617	35fa9654837ce66d0a1aa6aa7e89d68087580f7622873f42decdf6995d1c5e43	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:30:52.876	2026-07-30 22:30:52.897267
347	599	911995b561867b6c8d4550d57aa5b143b9b26ccbea018d1017df40cebfecf742	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:44:39.261	2026-07-30 22:44:39.310972
348	604	8cdfa5467ee8053beed472fd7d8d91c1c2cc064939320b931c71e98144dbb51b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 19:44:55.584	2026-07-30 22:44:55.602663
349	599	e8f4cd3f83e36a6c9fa31922953fa14beb5e699cb6d53711b649929baab299fb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 20:04:47.094	2026-07-30 23:04:47.130905
350	599	574e3e97efa466c2bab1144e271ab46f189bec931b74562c9eb185f39dc8525b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 20:22:39.901	2026-07-30 23:22:39.939743
351	604	116e0f6200cf2a929939d690b5bcc5d678bab4c2a03ecdfe5eb649333a770c7d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 20:22:51.878	2026-07-30 23:22:51.879658
352	599	66c72ea4d2c86abf582be106c8dc4755ea7cef0284f5eb7122bb9e19d4c48528	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 20:27:47.73	2026-07-30 23:27:47.73998
353	604	d71f48e276f9566e3dae6857edede1cb75c93822a19d064f057237063fa94362	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 20:28:09.86	2026-07-30 23:28:09.862507
354	599	0c224a0b14c1a59a56ebe450e03fbafef0a62cbde751a59e28b819430d9bc312	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 21:01:45.383	2026-07-31 00:01:45.413526
355	604	1f7f8d986145b011e30495da07bc7c778ccd36494ca72e34467f81c3b254c5a2	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 21:02:25.579	2026-07-31 00:02:25.583959
356	599	d8782dc6f9b56c8b0fd027d3d6ca8d771cce44ba3fa60b2598c3df387cd7ba4e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 21:22:58.259	2026-07-31 00:22:58.284042
357	604	9ca6473c1a7c4b7e4c22d36f2b7e6d82ad64e496e59fe0ef51a899d259b90bfc	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-06 21:31:11.695	2026-07-31 00:31:11.700495
358	1	e8a163f73dc8053b8657c60407f03a603765ff6bd4c3bf94186ad50d07887cd0	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 07:09:27.003	2026-07-31 10:09:27.014692
359	599	8826f6dadc69e7ca7b274849756910f22ce74ed08c5a3838165e3dcfbf7bc4eb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 07:28:05.676	2026-07-31 10:28:05.681351
360	599	4cface09ca0863b6769ea7bc888190f05a0906d7dfd663d826c3c04244e4e1df	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 07:44:52.419	2026-07-31 10:44:52.425192
361	599	4ad9c9c162517f54b06d8a94cababe845eaf243a15d1e0c55218748a44a6f7f3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 08:29:38.03	2026-07-31 11:29:38.048487
362	599	2547d80f508403ce38a2c5c221dd99b3797cf40b120bb68bdf0b28cfd731f739	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 08:31:43.981	2026-07-31 11:31:43.988814
363	604	69e35e44a7dceefe30108a795650f6ef11368940f045cc13584fc301966675f8	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 08:33:51.523	2026-07-31 11:33:51.529302
364	599	ec2c6f1d65a2e4cbd4bd296bc5bdf3547263d9fa1b05d1961fbfa1000ba68877	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-07 08:36:02.95	2026-07-31 11:36:02.956846
365	599	de0f80438eb96069e90634ef559544e08ffe0d34a5601dfe036636743b7edac0	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	2026-08-07 08:38:16.243	2026-07-31 11:38:16.249897
366	599	31ccde365855ae09067dcda5f1b7f14f6de12b7db4b720f221e1a83d0be0a541	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	2026-08-07 08:43:03.137	2026-07-31 11:43:03.145003
367	1	a586948b4a042f50fdccb3e72462ef55e921c25443f6052d85b89958af9af307	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-09 12:36:25.835	2026-08-02 15:36:25.848226
368	1	357df354262b6d0cd46f5cad4c1b09780577d9dc4a64cce492b17059b916b675	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 20:33:04.063	2026-08-03 23:33:04.078149
369	618	32675dd4362e21ae1fc24525f41e956a5cca1b46b7a47406882b3646f984c495	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 20:35:53.16	2026-08-03 23:35:53.162734
370	618	f7e39fbcb18c09e3768accbab7c39bb3f78c0c02885a4e3d2088303266e89df4	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 20:36:11.049	2026-08-03 23:36:11.051389
371	604	ebe3ea6afa07c800a059f2277eea03e38e5e0727356d1c207877318868967f1b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 20:38:59.935	2026-08-03 23:38:59.936966
372	599	f47af6740c5aab2e6edd6155c9642fdcb7815baf4e67b260898e0db94951fc6e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 20:39:37.035	2026-08-03 23:39:37.038164
373	1	8a5c5216c3934b3db7e936d430e63b53b9f77e1ccaa6d4c4f2668e81ce2b89a5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 20:58:16.251	2026-08-03 23:58:16.258532
374	2	c3db174d0d42f4539d9fc0e3e659bc2437ce56afae0dcc52486372980d479f85	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:00:46.101	2026-08-04 00:00:46.106366
375	618	aa9ad6c06e240b9d183d762a94422632f23a34599707a4aaa380eee8cfad6dc6	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:00:58.24	2026-08-04 00:00:58.242184
376	604	c1bc21686a4eed73ccf273be074bee1a05e4a086f382ca6c31b7bb511fa84c88	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:01:09.385	2026-08-04 00:01:09.386293
377	599	5fa58665441759d983d2f46a942b0e2bca08b60b96971b4cea7429967373da9d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:01:23.372	2026-08-04 00:01:23.374384
378	599	f81526bc87308148620f4b806f42eb84cb973479af5b2e6647c9fe2b783a04c5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:20:10.927	2026-08-04 00:20:10.939124
379	604	a2c0333b86d21e1480c53661052bc7e64ff074e271db09845f1146071808838c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:22:37.774	2026-08-04 00:22:37.780452
380	618	a3f5a335535a7b7d618ed6578a8d18f8a00ae09cbf2f5a1afd2f8d1a8e9125b0	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:23:02.998	2026-08-04 00:23:03.000278
381	618	041a243799414eb3e9e81d658a34fc5c05a775dc3035fd9a9a09d16b4125f5df	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:51:53.295	2026-08-04 00:51:53.300933
382	618	45e655a9cf16c8d9981703e22fde17c12b2326ff349a683f1fcc472ebc9369b7	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 21:56:08.465	2026-08-04 00:56:08.469397
383	618	e576644f238cb503daaf41a89c484880d20f9cd90af8338e436edc5134dfaf5e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:10:58.382	2026-08-04 01:10:58.39209
384	1	6213222785050b184713642d66b1b5551fd56c2f9303702e06c75818514150fd	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:12:52.415	2026-08-04 01:12:52.418238
385	599	e5829fd4ce052dded8aecab105a90772744ce6e8304f9ba2eba0fbcc6f3c4633	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:13:23.818	2026-08-04 01:13:23.820642
386	1	28d09a2274fb50d06a76d0ed66bcc3daf7604acabcdf49121801a0c1581e7585	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:24:19.345	2026-08-04 01:24:19.351719
387	618	efde4f85b6654aa5ab4ccaf7780f16695d93fbcd10d823c73463f7cdd03e7c1f	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:24:49.675	2026-08-04 01:24:49.678854
388	599	0a046efe5ea4edf9dbeb7f4299fe51e9dea80f2bc63cb0b0b69bdb728846e4d5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:25:16.655	2026-08-04 01:25:16.656841
389	1	788c93f628f9d1f628473d651c22e1fd47002a220fac555caea0be531768f8ec	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:27:32.951	2026-08-04 01:27:32.95741
390	618	46f0a382c170b32bca799ad8ab420c18d085f7deb7d92fd6794c3d8fc787e175	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:27:53.319	2026-08-04 01:27:53.321216
391	604	bdd7a6f564f0de4749d4b43d0cb7eac7e07a286c75c26b1dd70a36fdc0429a3b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:30:29.803	2026-08-04 01:30:29.805227
392	599	cdfc9c7d6918217d4708ff43cd55c47fe409e7559bbd2192d010c14c6d807adc	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:34:32.04	2026-08-04 01:34:32.043507
393	2	eb444839d15b3c0a91d326c64d7d14144651080ad9e4031615cdafa88ce6a957	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 22:35:35.595	2026-08-04 01:35:35.597135
394	1	9f517c34f12da188af112a38e8059de85a0e827060e266131efbf7d170340ae7	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 23:11:45.743	2026-08-04 02:11:45.753008
395	599	481e4361cec3e6d25e92e5799127212ef109e71dffaccf1f1261809da004e70d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-10 23:12:24.996	2026-08-04 02:12:24.998802
396	1	671ef0d94c8ee3ebd437d978d38a178eec394039ef90f13d057605601d55b716	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 00:33:46.128	2026-08-04 03:33:46.136022
397	1	703ca0c1c3f106bf7471ed24b7984e9fd4af8d3d4b9fcfab84e46dd7d3d3aa88	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 00:39:46.705	2026-08-04 03:39:46.719207
398	1	e70d091502b16900cf1823e679baf91084cf301b4ee9cbce56d897b2d43e370b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 00:49:35.391	2026-08-04 03:49:35.399424
399	2	52e9f10164172447e2044332ae875c76d24fedff4c0bd61fc94c2c3c8bd59a54	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 00:51:01.472	2026-08-04 03:51:01.478727
400	2	93f57afa5a31114773f8542ba8d734ad127b340afabbabb7c2092f5d000199ac	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:13:55.886	2026-08-04 04:13:55.908629
401	1	4c79eab56459ce68789a1f8cd79116494293aa3069a91a3cf227e520fbe6f1a9	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:14:08.839	2026-08-04 04:14:08.843429
402	604	379413b6141c8861d84e8e9ffabe8709be8471316b9561946b7dfffda6dd7738	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:15:04.415	2026-08-04 04:15:04.417515
403	599	0d200cf11ed53bebc824f4594fce3704ba7ad957d44617f6fb27fc3ca0897192	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:15:34.714	2026-08-04 04:15:34.716107
404	618	009ec2a5f9513372063ccacfd5163c63f1bbc45e4f1d2274cacb7334c8320ffb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:15:55.24	2026-08-04 04:15:55.242296
405	617	f3c9ada764e952f08619b0043adf3718bf224a44684ace39d9060ffc6beb6c0c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:16:19.091	2026-08-04 04:16:19.093452
406	618	2be8687c94ae11b7f1d4b274607f81b48d85e766dea647cf6d17201133ceca80	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:53:51.999	2026-08-04 04:53:52.010199
407	604	22deb6b79c194730dbcd32e9bd4b70192cced37526fe7f83694559e9b5d56399	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:54:27.031	2026-08-04 04:54:27.032629
408	599	941189415794862d03a49c33b2754798b9ad765e87c557832e6976c0beb7df80	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 01:59:39.197	2026-08-04 04:59:39.202582
409	599	19726b4dca7ed6726bf03903687fa96aac82bcaf724aa89950d04a829795347f	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:04:11.296	2026-08-04 08:04:11.304321
410	1	374a1dec33ff1801830c0268f29c5053d1c9dc5628c3c9a9ad053d63d8701504	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:29:01.544	2026-08-04 08:29:01.553071
411	2	d0f935e89b94d80536b7548557a791d8a19d012115add436fb2a9d6106c1aed1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:29:15.637	2026-08-04 08:29:15.640463
412	599	6b8e7a403a46ea4a6527c1bacd81ac685a3f14d59c497c860d994e5374e7e14c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:38:18.873	2026-08-04 08:38:18.880964
413	618	85a508b7a61e6a2279e7d4b41df8727a18cd82425e9899642de42d3056fd5dd0	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:39:00.674	2026-08-04 08:39:00.67658
414	599	c712144cb947b5cf46a066916d10568659a5b00bbe0cb01360c86562dc894001	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:39:12.195	2026-08-04 08:39:12.196888
415	604	518cb88ee5c3a3b5aa981819c579f56ef7dfd2b9b8d4105450e25aade9f14823	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:39:28.752	2026-08-04 08:39:28.753698
416	617	4c1be30fa50f31ae71dca0ea5ac6b9a51078ac5c1c74183d1253d8bb2153a8ff	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-11 05:39:39.42	2026-08-04 08:39:39.42238
417	1	dc708b6f9cb756f446116b1e41789f5fae4f213418349d1f4508d44ca5a31ac7	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 11:30:43.248	2026-08-05 14:30:43.267023
418	2	88d641ba619544c5a8cec2d94b325efa36ada10666691a656afbf136ff5fd873	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 11:31:07.001	2026-08-05 14:31:07.005527
419	599	767b9848509b9350815b72022df260d1af5431c55b30680d14e9692713ee4321	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 11:31:39.147	2026-08-05 14:31:39.150057
420	604	7c7bfb612281da5122fdaeca47c92169c04a1439eccba931d9ce11edd0d7dcb7	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 11:31:53.685	2026-08-05 14:31:53.687427
421	599	ddaaedba7dc04e06063d48736fc9805e7ae08301d0cfd7947423390c5bd833ed	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 12:34:18.05	2026-08-05 15:34:18.065572
422	599	52a0caabb4569aefa18c4ae9931e82bf89f5284731c38071db59f0932a16effe	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 12:34:44.157	2026-08-05 15:34:44.163331
423	604	c473fc9a83426427971cbf4cc50ccf1a0b65635a91319c3409ab60bd6ab19032	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 12:50:00.053	2026-08-05 15:50:00.062043
424	599	552a02d1acb664987d407f1f70006e0fdcafd608f5809210b0e670cbc0c153ed	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 12:57:07.934	2026-08-05 15:57:07.94577
425	604	4d83066c76eb7e515213fbf8ef3b0bb1d97faef8f61ba358b934287d817333b5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 13:14:31.842	2026-08-05 16:14:31.850433
426	604	0f74301650c819aa274915976abcd89834547f5d866957c8c1bc8e8b51044964	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 13:42:19.488	2026-08-05 16:42:19.492929
427	599	9b4414ad290d8d255bc6af80de4a29565f4e87184d7485edd2477005f4f26fa8	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 14:56:25.214	2026-08-05 17:56:25.22162
428	604	b759eeb330a2a6d7c9e4296df68248fa16deeea86e759ac2a0486f89fa31c0dd	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 14:56:42.402	2026-08-05 17:56:42.404614
429	599	f027b3f45eaa2f8d790f46b792b45042b00ffdc290f60207e990ec2c51c3e817	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 15:55:44.961	2026-08-05 18:55:44.974931
430	604	cfc828f77ff68dcd1408c347d2d13c8e07b34b1455478e100f21eac4cea5cc83	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 15:56:00.555	2026-08-05 18:56:00.560216
431	619	49aac501a75d86e3366c84b4c7e7dd0b45496fe27af356aa06e4047fd63f4003	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 17:02:49.713	2026-08-05 20:02:49.717323
432	619	9704cc85bd8f28ff8fa7fc5250aae99e79f07fdbb3fb881425b53cec499c3f59	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 17:03:55.953	2026-08-05 20:03:55.956451
433	1	b178af428bd695477f42116b4c5fef84152e46ea48642c8d0203883d1eb84d17	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 17:17:32.027	2026-08-05 20:17:32.032331
434	1	f32fd50e270604db9a04838400238cee096657209fc3947b39e51b8d42ec5d91	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 18:50:24.3	2026-08-05 21:50:24.315644
435	2	aab0fe6de57fd5624094e6371508b4c425f8dc4ed4620cb110418b01592f39b8	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 18:51:56.21	2026-08-05 21:51:56.212974
436	2	ced4de3370d6115b14ea68a81a4a70174a50d0caa74638fda42696a6f180a4de	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 19:13:12.383	2026-08-05 22:13:12.413519
437	1	a18bba1ad07caa1fa9d367b4bd764e4d431668dd7c1a0be8eeea50259cc107f5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 19:15:16.774	2026-08-05 22:15:16.781078
438	618	b96aa7a25f489e09c75bd321004394ccf2541b86d802c59958b51af286e2f50c	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 19:35:10.064	2026-08-05 22:35:10.069997
440	604	1a72edda848141d90ce27f3d495b4b0d0de9e99c539420a0cf7966ee11baad36	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 20:44:00.864	2026-08-05 23:44:00.897773
441	599	d1038ddc1517fcfa1d96ded62dbc781a6da991ee5c4dfeda157ac796db2d2777	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 20:44:21.768	2026-08-05 23:44:21.770567
442	1	8b8705cac852468cecea71b24fa230024d925216d82597ab12b8a99036941ecf	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 20:47:25.731	2026-08-05 23:47:25.737342
443	604	669ea2026de7d0a00900165790aeb59b636b343074ff23046f3ef42f09c1ffa1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 20:48:48.343	2026-08-05 23:48:48.345976
444	604	1ffa65b5016d79418fb6176611531c7a37a7372ef1028afb329424a7caa7158e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 21:04:35.594	2026-08-06 00:04:35.604073
445	599	343758670dfcfa00c537ff5b36c26ea11010acf6ff0ddfa9fc4794ddfeda2134	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 21:07:41.811	2026-08-06 00:07:41.815953
446	604	b00ee4adea438fd17a7209eaea8ea4189bc890ddb074ea58d7ffecd9ad937dc5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 21:25:53.754	2026-08-06 00:25:53.775132
447	599	38f67962fa91c73bbaa5e28fcb14be7c2d1ea1cbae9e78c379226d979dc3c98d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 21:26:12.62	2026-08-06 00:26:12.627579
448	604	396e8a76c1df135c132da94b60fd56c3cadbb286594153b5949dda837d751041	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 21:59:18.018	2026-08-06 00:59:18.036903
449	599	907e0a22e687193657e496aae9f7252e89ca0ffb887695deccf83facd54d7ea3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:00:24.53	2026-08-06 01:00:24.533435
450	599	6f21c2537fdc4018571b011e51f3aaf013cd618305e48f7d5e0a22f0443fb93d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:04:40.734	2026-08-06 01:04:40.740629
451	599	85f19cbb28775a0d0e900e3f6625e71200a94ea3b5daee01c6bfe4569f2fce57	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:05:20.948	2026-08-06 01:05:20.95713
452	604	76c4c1cfed30fb9d0bd2554808f50b753115fe4bdeaafb944a90b61b6504f80e	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:05:32.87	2026-08-06 01:05:32.871214
453	604	ed2da08bdc668f5c52ce35c2634389331863903306ead0a5b3540ba88a4b00bc	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:07:29.799	2026-08-06 01:07:29.807168
454	604	8a1651e6ebfc5d099804f6377c057e183b0e2eaff8553ccfb8ef62867a886379	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:19:23.019	2026-08-06 01:19:23.027883
455	604	7b4aaa2505bf6f0faf8372aafdff17c363e19fd5a5fe764ea8b4c5a23b33c8ae	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:22:46.015	2026-08-06 01:22:46.021739
456	599	1463a7eb832b331f9f3b41eef3a681e76f2d5ffe34cefbb8b3177b554f21f681	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 22:51:32.213	2026-08-06 01:51:32.231912
457	1	c7d6c13851ed635ee630e32309420ae87c4ea992922d691a5490528dd6d9d25b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 23:23:41.718	2026-08-06 02:23:41.731382
458	618	c5bb016b1c3104bd7386b09e9a29eeb56ee85715b35ac3cbdadbdedeb31aa628	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-12 23:48:02.964	2026-08-06 02:48:02.972978
459	599	83d42c0fab7faa9cf8cdf1e22030bdbcad0d59506142b67b89ba6dad56dc8a2d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 00:45:09.451	2026-08-06 03:45:09.459855
460	599	db6b830478ebbbbd775f10a12c0a6839b0837932e9d069791e39a48259a7ccab	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 08:30:57.37	2026-08-06 11:30:57.378035
461	604	2e0a5dddf0709b0517bfe145ce4b8cf0bf014b117edf2f7e6b0e409a9a604deb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 09:18:56.949	2026-08-06 12:18:56.95722
462	1	3c2600c6dcfdff82b3e4ad2ae2e040edb591457a75934801674aadef3bd83b2a	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 09:19:50.496	2026-08-06 12:19:50.497763
463	618	7a73f18a93a0eb4f15a4d55ae70abaa95bc3b9bc5806d1aa5a98eac831a89793	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 10:36:16.8	2026-08-06 13:36:16.803675
464	599	f44310f36249df58dbdf1e8adab410d8f4e012a469cdb2cadcbbc204e123e643	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Safari/537.36	2026-08-13 11:54:07.684	2026-08-06 14:54:07.695494
465	599	69525f66821cd12a9d002951ccd63c2ad4f9788387c1b8c5c79b1fd656e78a26	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 14:14:05.029	2026-08-06 17:14:05.037337
466	604	7e9a96702eef33b93f0c40ca2b49017e01aad1c91657b4113f732c2e131acfd7	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 14:50:43.462	2026-08-06 17:50:43.469095
467	1	5f33bf442256d597dba842fa3b1cd10c06bb2ec84fc9ea78293ecc6b1ef866e3	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 15:55:14.489	2026-08-06 18:55:14.494021
468	2	93f6757f247915754bb546ae5c636bfe714987490b9ff91f0dfd3586e98a2a40	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 16:03:59.552	2026-08-06 19:03:59.555279
469	618	9dc33dc239de77465383479d31751efa6d11686b0fe35136fb8a06cc4893ca73	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 17:01:12.817	2026-08-06 20:01:12.827088
470	618	80a05099ef07872cad9a7ebca31e49bcc2e6fb0ae2279375347d95f31bf1b0d5	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-13 17:03:58.327	2026-08-06 20:03:58.329308
471	621	36cbab40a3804c3211b8f962d4af89f6ef06816c2cbaa66db0231734485a27a4	::ffff:127.0.0.1	\N	2026-08-13 21:11:42.39	2026-08-07 00:11:42.396375
472	621	f29044165af4aaa25f112ff274a7c9e37244e6a8170af1efa3fca955cf5b19c5	::ffff:127.0.0.1	\N	2026-08-13 21:11:42.836	2026-08-07 00:11:42.839565
474	622	531e2bf1e6ae340ed8ac3cbdbef3b77d9ce4024d6864e46d246ef29ceb2cbb75	::ffff:127.0.0.1	\N	2026-08-14 14:56:36.759	2026-08-07 17:56:36.765542
473	623	15f366553f8343835cce1df5a36da02604d0f1e70e65b73024b38a4c3ab15061	::ffff:127.0.0.1	\N	2026-08-14 14:56:36.757	2026-08-07 17:56:36.764065
475	624	763c3e9dd5de41858e2ff7219e8c50604da8a0591ce09e40cd1616999766b69f	::ffff:127.0.0.1	\N	2026-08-14 14:56:37.215	2026-08-07 17:56:37.218891
477	625	5810e77a06e33402595df03a4e7695f6cc4e8dc972c3d9447071b03d39194aad	::ffff:127.0.0.1	\N	2026-08-14 14:56:38.446	2026-08-07 17:56:38.453186
478	618	30315f37e63268014e8122468c786317e53558a4f32785cf88928ddb52986595	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-14 22:57:58.711	2026-08-08 01:57:58.715297
479	599	9fe557eab0cf781fefffa99a935e92d9df734c8126069945fd61522a2e97ec24	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-14 22:58:14.603	2026-08-08 01:58:14.607428
480	618	7d1072e9b748cc867434516ddbe84231cf4023e07b4212438227fd55b31c2cdb	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-15 04:54:35.267	2026-08-08 07:54:35.274336
481	599	54dec8d1e7a34b58647ef031005ad077e4b82c9bd3560a5f96b6e589bdfe4252	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-15 05:03:14.954	2026-08-08 08:03:14.958407
482	604	c3131d1d23734afc9d7cb48048212ee6b6ba1fa53eb16da1965153c685d1622b	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-15 05:29:21.36	2026-08-08 08:29:21.366428
483	604	f6aaa14a6cfe762e089a182ea8a2112263efbc0a5576c5dd917c30a53fe6d54d	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-15 07:23:12.705	2026-08-08 10:23:12.710905
484	604	daaca6864a134b4d9e73b17eb9138952bc2dc2684338079830276442063dbeb1	127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	2026-08-15 17:34:36.905	2026-08-08 20:34:36.913462
\.


--
-- Data for Name: support_admin_nominations; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.support_admin_nominations (id, nominated_user_id, nominated_by, status, admin_account_id, credentials, created_at, updated_at) FROM stdin;
1	618	2	revoked	620	{"username":"support_Taiwan","password":"VEL-SUP-SYRQ7MPS","recoveryKey":"VEL-SUP-54847"}	2026-08-05 22:14:14.837387	2026-08-08 14:06:18.558
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.tickets (id, user_id, subject, description, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.transactions (id, reference, wallet_id, type, amount, status, description, created_at) FROM stdin;
1	DEP-865D0B09E6A9	3	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:15.404905
2	DEP-AB24AD345A65	4	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:16.078756
3	DEP-E10F1DAFEA52	5	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.125919
4	DEP-FF377DCD5F84	6	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.127081
7	DEP-50864394F055	9	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.144922
6	DEP-3510F485E195	8	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.140979
8	DEP-D85E275078F4	10	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.146145
9	DEP-E3856F8BDC30	11	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.147836
10	DEP-44D8E52A86FE	12	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.259682
11	DEP-5E96A802B216	14	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:02.551275
12	DEP-5587AB9965C3	15	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:03.218349
13	DEP-A3DFB4A8F27A	16	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:03.872634
14	DEP-DF59785D06A2	17	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:03.875496
15	DEP-C13111EF0AA0	18	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:03.902903
16	DEP-0B0B296197AF	19	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:04.288833
17	DEP-78AA4480C72A	21	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:04.324039
18	DEP-60EAAD5C5215	20	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:04.323143
19	DEP-584CB78001D9	22	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:04.684326
20	DEP-93E52EB17A94	23	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:05.790842
21	DEP-9308451B80E9	24	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:05.807495
22	DEP-94C0427B5730	25	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:06.492551
23	DEP-8EBA81A1CD6B	26	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:07.263147
24	DEP-00329FB20030	27	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:07.279737
25	DEP-6D0114E9E042	28	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:07.322673
26	DEP-6D81A66ADF62	29	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:07.681947
27	DEP-7BE491F07E85	30	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:08.381066
28	DEP-A5F22C6E0E1B	31	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:08.771119
30	DEP-128DAE6DEB6A	33	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:08.853167
29	DEP-E303427ED969	32	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:08.851513
31	DEP-EB45EDB63987	34	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:09.181343
32	DEP-CE8CEE73ED7A	35	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:09.521857
33	DEP-E97E8744544B	36	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:09.914638
34	DEP-347D53397A4D	37	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:10.655122
35	DEP-2616D43ED327	38	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:10.661524
36	DEP-197F36520691	39	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:11.359599
37	DEP-E374ACC6EF3E	40	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.150736
38	DEP-208EBC17F962	41	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.500585
39	DEP-1E571CF1461F	42	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.546812
40	DEP-4DCBDCAD7F56	43	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.551443
41	DEP-9FDD0C6984B9	44	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.566029
42	DEP-B5D38017EB2A	45	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.613178
43	DEP-3BAED6DA7EEB	46	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.645951
44	DEP-C9B8847401AD	47	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.647282
45	DEP-6083A0E2976B	48	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 15:01:12.705499
46	DEP-E12378524C48	49	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:28.565982
47	DEP-114E85E66268	50	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:29.252248
48	DEP-51DFEB0E7599	51	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:29.281807
49	DEP-12477A1D8641	52	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:29.956277
50	DEP-845249B40EB3	53	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:30.681578
51	DEP-6F85B1E19CDE	54	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:31.01593
52	DEP-3F2B29A799CD	55	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:31.050133
53	DEP-6F8A4E5CE2E8	56	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:31.068808
54	DEP-074BAEA83D73	57	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:31.06938
55	DEP-96A962CB2D0E	58	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:31.748714
56	DEP-289429F05A2F	59	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:31.772714
57	DEP-87F25AEC5939	60	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:32.093535
58	DEP-5562169187BF	61	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:32.500219
59	DEP-E76B7530EE2B	62	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:32.54169
60	DEP-70F9A8675E8F	63	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:33.785343
61	DEP-9DB7694D2022	64	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:35.259359
62	DEP-5D92DD40037A	65	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:35.276926
63	DEP-78B39676CD4C	66	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:35.613013
64	DEP-4B2E0A0B505A	67	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:35.955443
65	DEP-14F6AA3FE6BA	68	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:36.887681
66	DEP-DE796455DC34	69	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:37.693485
67	DEP-60CF934BDE53	70	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:38.032852
68	DEP-EA48C8515809	71	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:38.055691
69	DEP-05FC5AAAC77E	72	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:38.553486
70	DEP-6BF49008B04F	73	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.306082
71	DEP-A1FD171C6066	74	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.678842
80	DEP-8A8C75E325A6	83	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.884043
72	DEP-13DEDDCCD323	75	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.726114
73	DEP-0548663BA31D	76	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.727757
74	DEP-06712FF57113	77	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.75067
75	DEP-316D60CBCE35	78	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.766928
76	DEP-F2C6F8C4D83F	79	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.79175
77	DEP-8EEC7AC3C1ED	80	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.794552
78	DEP-E14B698AA44D	81	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.838205
79	DEP-A9D23DA425AD	82	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 16:22:39.866364
81	REC-C2E11B4F072A	85	DEPOSIT	1500.00	COMPLETED	Recharge from card tok_298782267e261119da8cd2f0	2026-07-30 01:12:03.27115
82	REC-F746CB62CB6C	87	DEPOSIT	100.00	COMPLETED	Recharge from card tok_3d605eefa2f0d79f208c83db	2026-07-30 01:21:09.688478
83	REC-7FE08396C49D	87	DEPOSIT	120.00	COMPLETED	Recharge from card tok_a12cdf9e240b815055e81a2a	2026-07-30 01:21:26.692054
84	REC-40101C38F368	87	DEPOSIT	1450.00	COMPLETED	Recharge from card tok_3c077f70368486cac997ec17	2026-07-30 01:21:45.862914
85	REC-694B2286F61D	91	DEPOSIT	123.00	COMPLETED	Recharge from card tok_3c077f70368486cac997ec17	2026-07-30 03:53:52.242232
86	REC-6700EF3ED1FF	95	DEPOSIT	1000.00	COMPLETED	Recharge from card tok_deb1a765147f9a63fd71defc	2026-07-30 04:03:11.448375
87	EXC-CE98ED68D525	95	WITHDRAWAL	100.00	COMPLETED	Exchanged 100.00 TWD for 3.10 VLM	2026-07-30 04:03:37.903626
88	EXC-41C4CC12E64A	92	DEPOSIT	3.10	COMPLETED	Received exchange of 100.00 TWD	2026-07-30 04:03:37.903626
89	EXC-CA7280C86894	95	WITHDRAWAL	300.00	COMPLETED	Exchanged 300.00 TWD for 8.56 EUR	2026-07-30 04:04:27.048208
90	EXC-E4D930359309	94	DEPOSIT	8.56	COMPLETED	Received exchange of 300.00 TWD	2026-07-30 04:04:27.048208
91	REC-2BBF7A332A09	94	DEPOSIT	66.65	COMPLETED	Recharge from card tok_6e75f402a78c2aa9b887959b	2026-07-30 04:21:02.078479
92	EXC-A82EC5AD3724	95	WITHDRAWAL	450.00	COMPLETED	Exchanged 450.00 TWD for 10.49 VLM	2026-07-30 09:57:34.662254
93	EXC-FE9FF37C19C4	92	DEPOSIT	10.49	COMPLETED	Received exchange of 450.00 TWD	2026-07-30 09:57:34.662254
\.


--
-- Data for Name: user_devices; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.user_devices (id, user_id, device_id, first_seen, last_seen, is_current) FROM stdin;
\.


--
-- Data for Name: user_prekeys; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.user_prekeys (id, user_id, identity_key, signed_prekey, signed_prekey_signature, one_time_prekeys, updated_at) FROM stdin;
3	619	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"LSXa6AB905BwZmSGScZez3qSkg6ahjwQxhuQojaazr4","y":"-9JKrGNOpbZDBb_aRHg14bdWzVwBNwcisTnqRyaQsiU"}	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"WVq13lrCwbrV2401Ik2ADIsFFhQztm5fcAH5i5ilKWM","y":"yo_EwTjuQeq6kOMiWduJygy743iQitd4xr0N68-Ks0I"}	valid_sig_p256	["{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"c26Ed778mE0uirb_x4Lhh_fMQN8Pm1ilYI8O94F0zSU\\",\\"y\\":\\"Y3xlBmijqzGmN9gxYi-LPY6_xo1TrSzaD5NMt0QHLNE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"SsDEqEhm0L7FK5Vx6COYeU_NHLo5Fw3XiyLO86Jg12M\\",\\"y\\":\\"lrExPP5QVAzJ_fA70oJuygx5-0C7I_ntjslnELaKGaY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"7TtZz7cn5WKhqfKzzlBEv55oDi86QspGrfkEn80T3EI\\",\\"y\\":\\"DXZhDjAzlXzFlk55l8jgIlhElGStL7HF5QBN_aAGnNY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"PH3gRC2EKMXJltGw-EDJePU7-QSOWFNAWKutf7OefoI\\",\\"y\\":\\"Yi57TyOpdmEgk6Dfl3-eC-g3sqSrbmq5stS1dPdZs1I\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"qmJEvUCAnQyjAcb-gIgrH8ARpdfZJ1F_nZd1fvOoHak\\",\\"y\\":\\"pIUI9yk88pFCDa58U_KrX-ABbrU0FJtOEo9uOlgj9Qw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"gycmU11WyhrxTVs3Sh4cel99AmQg4WFJ6t6M--OWbhs\\",\\"y\\":\\"0bhdLP0ch2297VeHnSO0A5AeCMpuilz8mOdqww4zCKM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"DfCyrb-Os4UJp1Oh61nZUEimKYj59U3m4m-KAXQndb8\\",\\"y\\":\\"_tVkkglp_oK_TUwLcgSXWXnXuLxtUvKVzzJebra3mOk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"8T2kJrB2FybOSVEkRpAZLNEczuyGxNQEnTCR0alS5sU\\",\\"y\\":\\"c9SnozGpAj_eUF6ncZgkSKvtDuPNWYcValmy6LJQAaM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Fc6bXzNPW7LJQk6jE4RemXHX8IcJpoGgZ77niWvGcEc\\",\\"y\\":\\"lpqaB-THk6eQrmKAAj7xlz3CkUVVU7pXTPQ2evJovF0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"UGMeGQYfIiGEiP1QMkaK_FyUBKdhQgnMdY4aQFiE-Ck\\",\\"y\\":\\"94N63QsCCNcF5SdSf6mGIlGSBHvx4oL7HwrZzTtpOXY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"zVC2bUuQ2cEit_tyIdTuKXCXi06iJxXWVUhTvu7wjT4\\",\\"y\\":\\"roE3weRRC4zwvzUCRd2NBnnUYzdLL9qrgiM3yjnSmVQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"E7ftMhEcmdCzka79TXb29D0lm3E92K4ifyfQmt27a1o\\",\\"y\\":\\"7nFxvNXCAOXQvqhbalVa9ZF-6ZGpF1IDyE-b0SLreas\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"KVkRDJSteQTWIh-d0RtcQGGlUbbrG8_n4tlRpm79Pf8\\",\\"y\\":\\"9ZLnvhUtZ6m_p6k1a6Q0xO7Knfi9zYtTGRxc3mQtv9U\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"_E_bq_GF8Jhd2jWXzniYiuXXw90rzFtZE0stWyE1Ul0\\",\\"y\\":\\"f6-6TMan21GEOACaTfxj9ghrEv3oRDNiiMDbcNcIkEc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"uZPaAzh3viAaJTRtdK3GSkg0aWVAbsYPJUSy7tjHgbg\\",\\"y\\":\\"7hSg-blkvrFRAYi0xAOnXD3zSUibl1qg0AgSK46rwig\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Y0RLLAxPja8fWJM3qGbPn2fWkAihy3z6z19e1c6nXiQ\\",\\"y\\":\\"hDtJYhFaaAkKjLxS0OgufeIvd7kXlje5d8nDvmgh4K0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"qkXo8iXi7z39Acua3pJaDmx48XOR6kq_WONFpv7BT9s\\",\\"y\\":\\"MQzF8B4uygdKy4m4WeRsoOu4YL5GJPJYAtGQQSk6VOQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Emp37qKaA64SIl81WcxAMHlqWfWMTPyQAGAWQAiQxiI\\",\\"y\\":\\"tZdJe7HPkCwhWaHsvTAH4ETw8feWASMsQo1aO7H_UZY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"r96foFsaX_NkduXOBcbzE_8JqOKR2Ev4n_wJy3kJ0CM\\",\\"y\\":\\"VANLytGZWRnB9gZfMYE1ZdiYvRt9pGRHFTT2T69JKZ4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"sQSdR9JN5vGbEd2Z26_d3qPpOkrVwLWMbVO1M6t38ZM\\",\\"y\\":\\"1kNivgL9aJhNgwIoWWxWf1llRMAVhZixyr72ZfpM_Cw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"UF-aCHa3fJG8HCX5URZI9ly8nlkLEfwAKk2_WDZlKwk\\",\\"y\\":\\"qh1ZI5vmMgqrynXrfpjbPVBxtVe2-U1b_vEFYYbBgjE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"9sHNGkKWQ7IQ_QQOJcNAqTVia2P698xlNBZFCDbIcYc\\",\\"y\\":\\"m_i_MP4Ns_J3juWS9hikrVrNcst74cgqbZXRKDbEKOE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"D16w42C274CaQsSeR_TexwOHhikFcqMBSkwJ3FsZOCU\\",\\"y\\":\\"tfdJjRRLScZR7LPb9BhqxWa9Q-QGl0vp1XcSJWlchMI\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"2g_E-e4v4pb_DnFRYPcLLVRCfpiNh5BoD-Sscftii8U\\",\\"y\\":\\"DTr3OCwoT-7KlGOJWB4KlrYMkNSO7QtUpyCz-8xuM-c\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"iYh3a29F11NkomjA0CsALdgtvQm5d0KFf0bfhqWKlms\\",\\"y\\":\\"TQEvZnnH1XvXEVSfeZdZG-ipHDax6jCwOXXtKWl6QOw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Ngyu1DB-uR4i-5UhI8p_Zdj7hXPX3QZfyKozBv71Jy4\\",\\"y\\":\\"V5k56gIRTqFfqt3ueQDKHs7LuDIxux9XNw9AbgSExkI\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"iia7WZ0AqgxnjOpw4u4z6Lho4k4NmglsfgrED7FS40s\\",\\"y\\":\\"PUOw1WVf0LlTG7Of2MMBFAUq-WyafZ1pS_rliB6tTaQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Pv6Y59ATFVSy3VTMOdep9RmP_euCQKt-U6nb8wnGUvg\\",\\"y\\":\\"vNAO_5g5aNGH2CjB7XpckG1fpZ1wrhxWsMAwbRc_TtU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"fKzxAhoGiZqyzqi_Xq9-f4jwcC9Rbep2t0ztwLJfE1A\\",\\"y\\":\\"kknr-4EOaOMFvj-v1rqQ8Xx6d8RDL7Th32jKWbehJsw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Xd9LpbHcMKA7duyTxh0QLOWb7kgRerzmCSDk23I3xFg\\",\\"y\\":\\"zZ7pAWuhj0bD7_4AIG2LXMbHTj0w_1VK_7v_EgkEe2s\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"tA9AVtPUO0w3trEtjDm4GhV11-gUMGlohrNZUks56x0\\",\\"y\\":\\"eoAJ2dV9PAaUVn6rg9myb2_VvzAMCBIKy4pQobNcqzQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"wSMPXH6tqhecHo2Fnv3vVLaYRPurHSKCvclTvU5UfB4\\",\\"y\\":\\"OgZn0ZDNYBelN5gaewu33NNXWKSnRVTFjpyHhm7Ahpk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"XLc3IBlj7u--b9_9LDAWdmUxL7orlxu_K59rtMTFNIc\\",\\"y\\":\\"IWxWUQCba3vaC_kKy-16Nkwb8jxP3TL2gQiYzS9pimk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"iuXbbclkQSzguvaqUO_Ht1tUY9LQHfDeZJPssSt_W7k\\",\\"y\\":\\"PsqQbK32yRdsWf3mUOXIXkAXmrtAvchOQrIcUlO6hOk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"GUHfZokJzQlkQl3Z3TMifuU90BF_D_uFgqvcAN_0Kf8\\",\\"y\\":\\"32MnuxI9vV1Kprhrrw_HxB9-xrZ1hrXXe54cJLR7ESw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Zdgk3xuWDfD12K2jTCCn4VL_IIFBu4nxSsYD9dWblp8\\",\\"y\\":\\"aT9cfEw0I_S1XoMQkSgDWbrsF1ifBpmH4x1csAnQKRM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"oQoW-gFqt3brxn8I373ZTEKXB3zIU0emTUm2TJASgBE\\",\\"y\\":\\"GKwt85oGvKjPFpQ3uZVPyB7W7jCg7jiSIsfVftfpag0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"ocVGX20DkNfn0C8WyXoLJgCIwjPTFl7F4E2zR-SsgQ0\\",\\"y\\":\\"vvP9ZH500DX9s9sH1Hqt8zHJUF5W7PZZ8_1k8-Ue4aE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"vJ3g6ZSWQD0ebiyF6Lpt5bmjtgDtsom8ueDWNPzgW5s\\",\\"y\\":\\"gCgZWMn353sGhvY1z4xyrxPiPqQTqhytFICYPAm3qAc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Wyl7KAyCuMeB43mdW3iYJbrBP1OgwTzPHaNwgKQvKZM\\",\\"y\\":\\"lOQodPhWdV-j8AKpMtZXT4Q6WIbkMw-NSHEgdbd1MIg\\"}"]	2026-08-05 17:18:34.567
6	618	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"-mtNGhooQY8S2iliB1EvaO5E5nSxU0dunxS8C3tJ3mA","y":"UJ6-nT5RW16kaFqchCqyr8O0B6mPD5qy_v24zy-ASq4"}	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"ecs-1z3p_8uRLMHdbdnobHH1vfZ9Fo9xDV23qoXu50o","y":"2XE8vByTBGaoR0kLuDT9RDLIuP5qX1sHDBu1MmE2SI4"}	valid_sig_p256	["{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"lloMUZPcK_xg-dZY-EtO5yHEvGWDwCTZVdbE6ezcT3g\\",\\"y\\":\\"t5mTa7oNFnIWP00jvg4_M5YDZd0_FWjCwDMXzILqd5I\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"HcBBjZ9LfFMgOqBwUyddfnz7eeVjWUzxM9JwQlOl0tY\\",\\"y\\":\\"jaAcMgKRShRUZ7jm-7TbhSTaOghHD--wI6ZBm6iSlPM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"KXxP_rtnYGREVqglHTXQTvbKrwv9tRPCvoqIZxEvRek\\",\\"y\\":\\"KF7pCPkAaAddC00f3i57ik259kZHma6Ma5X421iPIy4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"38UK-MH2SgGM2M_MtLOtkCQmZjC9uiCVW2l89pysoyg\\",\\"y\\":\\"YTZrnlDx0bVweILolex2amGroXgYfyJdv611upW_FPE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"RHyyTEvwzZwkMZlPG-Qmz08J8jEOyQI--9C6wmcZE0k\\",\\"y\\":\\"2jJmaW4ZIWWUZa6uylDhxHEefMMBxW5ZfKfFRPeZF9U\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"g767NxzdrWSpEF6B-rsS7QgAvjbQ8k6-5aM9V3pjQnQ\\",\\"y\\":\\"pW3L0QdQikme7mAFNyUeKkgqI85IoxBSfUKrMrDz_zs\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"yyQUsEOsDJRLm5LDBclHWPvk4k1qInrnQBr3wXaZj7g\\",\\"y\\":\\"K4FYXIBQSFz8q47GdbYi3-iXDgpYq9IRqmsu3aGkl3w\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"GumD4SwflvKF_JACYySSq-LgTnml0MJJkziFjvyVvHE\\",\\"y\\":\\"VaEU3kwCD-xJDiLuMSczisEUbTcTefLraAVF9IzIjE0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"LUDGmN10x340o-7mvQ4G-ja6ceA-aLA-GR4j7QkhTrM\\",\\"y\\":\\"mPHcb3zJIOy5tK0XNRU6-OBwAZTvMvnAcnswrtpSVM0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"hqWo6XEah5-do5oiXTBKs-yuxjLb7cDbKerWNrYxd8o\\",\\"y\\":\\"fbp2cTeY-emyer1NfBJUAcq3qLDNGparE9PLcePDcgo\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"wpj0cHdVuleO5eC9RBdGvm2h4Zx1-Y_DRpYSrLG_uDo\\",\\"y\\":\\"Uy5RZh2uZz0MW7KPU2OW9q8LzAp6F7UMoK0Bnj92m2c\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"wikfyP4VlRJBlTJqI12boMrFp86w7UgMweF3h3SPmnI\\",\\"y\\":\\"XTnu2IQRWh1FZHFidRNiP12Ttg-hDq2iLV5tM5FdQyI\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"7xBuKaUQVRu-s9sfAh5fOsoznz0BfQ6PFQpV0OpiRuw\\",\\"y\\":\\"ixpTt1FgFuYGGxBMZj52R8fh60CWQv4kR0cwC0ZyzMc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"uQCWKfybKP-JX-xscoW-896VIdnyItafw2xXW8RkjxA\\",\\"y\\":\\"qgj97JxekzrcjwGOQFZVITqIy54V7X2SrzcEmSqFCHU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"03Pah5b_8IV05XFLscMpPfg5tKEhgQvmrD6fbvyZqbE\\",\\"y\\":\\"OXWR7nUCbEPQyC7XEvq_7Y6pBv5JGW8IcTQoypoQ4S4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"IcjeCAnBqicSaAk1wANppE9jPGbsu8NBoK54xl0d8C0\\",\\"y\\":\\"ewPVT7j5w2JTz-0RvnhO27WQz21Ic7LNsZ6krDrtAhU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"-3xKMflOUpwm8Mly_S9g3RP_YE1FhaJMxvqdJRVxAiA\\",\\"y\\":\\"a-rfHNpswbR_BTZETs7h_0bars8CON_SLgA4iCxqc1c\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"JQTLR2lomWrh6dW5oO31okCV6-s-SjuJIw1RLlbua4A\\",\\"y\\":\\"BxlgIWKuNMpxo4BDTLkkqEl-E3AypzF0Z90Em5TwkYY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"0xSYjXhUiS9EJkJxVCV_DmY0WXTY8zv34i3TZ6ccU3A\\",\\"y\\":\\"i1KEFneLNIk8SW0NXzorpoDftixZfWnTW3tFoxfVQaA\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"q1RYuXrAJ8NZYl_anmiq2-ieVLe9yGzYn5PUWLH5ork\\",\\"y\\":\\"1x3oAOkOaR40iGy-uFuk62Y1xfMufy2j5RRq090tlS4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"kXjTKlL_uRiLX_xhFhRrbhC1dciunbZUos__A9KhLeo\\",\\"y\\":\\"F6pqTYQrwIciTyCDLE83_xrQf4WIXkltw8R_ylBEaqg\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"4_ojV7rMvM9X4LPUSmad2rOJyXPjaG2xi8gBQM33-OY\\",\\"y\\":\\"iNUMg-DnqOKRbSn0BXN-4_Kd3KhPacIPXvJAUmsd82Y\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"lbWPje5gjDiCY3wo5eUGeuQvzV9pj6Ce3sS7F27XAGU\\",\\"y\\":\\"FGsYONy1iIVID0-qq-SlUV_K1aFQCHMmpvYMmI9LZj8\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"3Rti7SG3G6VWix0lhR2D6t2KFN8p8glzuQJGZpaTAWA\\",\\"y\\":\\"mKWk9G4_VVSpQ2w54d3fbS5jqYqGhLoIEjJVR2jGdWQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"PVU_zO6-9UegSRVQ8VQI_RksPY_lqo2QJQ9q0xlIJhg\\",\\"y\\":\\"yar1Shlem6Plt6euVISCG6Z_nPhOx4ybBoy80U4K188\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"0fSw0uVtOng9jilvt2guvcZhPbpvieqn-37IB0xg4hU\\",\\"y\\":\\"CFD6vW3VFm_943iYpZJKhAZx4UtQa64sQJ3or9F_NC8\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"T5XqnoUap8iLuh9y0I4K3kcoxup2gOj2htZCJXwudr0\\",\\"y\\":\\"EG2gq7uM7tBsmgwO4zLMJggd2hGrz6M6LwlE18c6lnk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"xBQYDeh_sNioP3nqcpE-WcOWKcsDHGSV-Xj1Wk6HHNI\\",\\"y\\":\\"DJ0_sACdOqRHutjCkTzxcDaWynsjiCNsYXNBdCA0DVk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"0-PIWghFwpIZ61R19_PgHA2gjAYgmdha_BaqNgu7Iog\\",\\"y\\":\\"74bp4NHPFWXx67dmEOhUttz6MXB4pFg9rzNZwJvS6I4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"8PMHWbmasP5rnoL0Hu865lm_vxXirgn0mvD5QrNksVs\\",\\"y\\":\\"H6LLRX-mbWdoY8rgnF1ZgdPh8vWyYnYfHTc7loUzSCs\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"7o2-kicXufWd0JkM0LNb0SKecjSNRtyZ_g-uaaD74fc\\",\\"y\\":\\"jOLqKLZoaQiNoLvCcCIvyyNtT2lqc5bGS5LZAfAmtkw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"jZ0AU3dNyM7ZeW2qP8L_ALXMXhdHcHF-k2l2MIsIbOM\\",\\"y\\":\\"UQcp97N6_tgdlb-lKvHXGzAFgiq-0kgDYIFnVnktGoA\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"93b-CACQ6WCRZN6F0Zbj7vJOWuXFk_w_oYZ6iXge6r8\\",\\"y\\":\\"7e24UfdMDGXPfBpQDibj7OJZWRUsFrde4PQNXTYNehg\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Pxb-6utLqcmxMmVAzD5te-3z5oUJYA3o-f0k9qVu5Ic\\",\\"y\\":\\"rwnrKpRTpfTTkqJRBmLDuGBudKWXjQ7D98t_HIKw3ks\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"_1ZbjKp3DywIg3seG3E2D1AqQoTiDFcUipGzyuWVlCs\\",\\"y\\":\\"_HhlGAqnzlR5XN0eA4QLRacrXIlknxj3OudAcOhnWdc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"3Xq7-pc5d8Q3PnVOsVqaOSUgd-k7NfzjyG2qjDjb1x4\\",\\"y\\":\\"64RDFiQ1E_Xaaj3F7AosE-xMyQCyPKGufFbvVzwjBxw\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"CDBXrpi-jP3b1vQVZ40D6WU_HTPihqdDgsfm4cAGURo\\",\\"y\\":\\"BV8J8ZIkYxDvDgQs6ky9fga7LPhQX1ynQkn7i5ja45w\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"_RigJQ5HO_CFzf36YGPvQIf_RBwHM1n3nXv9Kuaow2I\\",\\"y\\":\\"zjLMhUVE5LYAELO6vE5FLAV8RMtPmA7ddvlPcarnIfg\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"leyXaUw17u0TdZa1zS2WkVx-uQwnU3SQwRB7QU9Gtz8\\",\\"y\\":\\"9iuAX64kytK-0F1pOUvKvVHpWjxAACJORc86TM1fO40\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"ExoKGVmPxGznfdbcCpmN9EYCLDNCPkLkp0FWC9z6FsU\\",\\"y\\":\\"cmj_WWHTgMdrCI5McZEbbWu96j4N7XRAzM_GMgGhbX4\\"}"]	2026-08-08 04:54:36.682
2	604	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"y2fZRmzRNl-ts54w23XgiPBVITbtTE9ncEjWsKGQ6JE","y":"IeR8WND6T7LdguNO4Vvhm3vuZSV3_AGmpnsarADgbSM"}	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"AWfD6yzZGKxoNdeoBGkJEJDnqAu6-f1BnjXlm7R26P8","y":"lcwqY5WgxAPyVkKiog8nmh1ExCeFpu2zHyTl539Xalk"}	valid_sig_p256	["{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"q_8CsiQsKwRxhGSjB_NMUI-EriovMSesw8gQn701KMI\\",\\"y\\":\\"Bb2USVHpp7xHiXzcziYP3B2DBAzlG9FPnZVnZn-thgM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"M-IB4cDnkeCSPOy9M3YUbG1mUsnQBsab2LL71O5uhOc\\",\\"y\\":\\"0qJaRhiJw_Zg8z4Sn5tfIL5xPtVPY12Tyf2I785Vp9k\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"NNrpziJs59IMZLdxoX_gExrNvHrALrkpOoCVnZfqVD4\\",\\"y\\":\\"MPOIdQSw-QzJ2aF1hOxtAZcU5ElfhclWkXc5EkCT5lA\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"DoDNlOyUXuYwzZlhtC3F3FB7sqwYr4JzJxUp5HFcIcY\\",\\"y\\":\\"2NzNPtyYty25p6IiVdNQsU3w25YqjzDDKg7xA9qsP0I\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"MTqSPQqM8m6-PQQU6NRUvwEbD2A2qRccC1x7dxSjHDA\\",\\"y\\":\\"9sEZBARbvuz-dtzVFMGmYCiYHqgREfzlaP9GD5uiFUM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"TqSRNkgs2DenmKQz4QH3Iii_C03e5Ogkp0MiFLBv5ws\\",\\"y\\":\\"g97d0Mu2hNldrvUB04oPjQgWW_ptW8CUIjsVK6BTVOg\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"IpmwDofOlvOcTfSCSSiMHlx2okdftJwbeDLDJMhWu4k\\",\\"y\\":\\"gm5IoywHyDxBhbdbB4pTOOmrRb93vfbM4hIUWxaDRDU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"i4rgYddo9q-t3Bd5vB0aQ3zBXF3Xssye-7avvmdXPjU\\",\\"y\\":\\"Pa02dv26hKZSONOi2tVbSksFbVPTExs-45cBKbUaCRE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"fwSJqGDJ2o41-cOZLBJXTp4Zyh7S49RMIx9__eyYBTc\\",\\"y\\":\\"Ldomo1y-YM1yQUbk9viZVScO3q2wCJlS3SxRgmEPdII\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"NY1pWrj7oMP-rrvonmrfqPPwdq3rCnfxcxfDiyRvmq8\\",\\"y\\":\\"ilD358eXqGieVdZAIWGHDCwxswWcqygT0ZIYFgDDIrQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"GJ2_F3ssBM4wD2rzlbvtzHvEH3dNp-uBwU9YTrMTEgk\\",\\"y\\":\\"hBD4NftxS-cO-ihZgqRAwgUgV1bDiY39n3oFmsJqA0I\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"qa8kuNTTXQ9UxAAVjTitMj_Zu5ZDBqot0EDmqyTb93I\\",\\"y\\":\\"V_6ZhGg99kjl2F4V1h2ihYQIQxyTkrEp9iZq1E28oro\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Z0a3oxpmFpTIV_2U1QAdY_HRj1jBSPKgFkOEEhwBXhA\\",\\"y\\":\\"V_7heDZaGJqJ8S0o0Rs6hwY69f-cyDn0gPCoazp7PBU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"IpKWzc2W_fIzoIG937IKlRUnecdYNDTpA3imVrhY1I0\\",\\"y\\":\\"GBX_-eZ5Afv3LXUCLyX1XNOFedf4x44Rc41y6AamoTM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"QcwzdCS-m87wn3w_m-o4w5uXDCCoK8t0WzHa9VmGyQI\\",\\"y\\":\\"BhkDNpTLKPrG525RtwsAN7Rk2OQN9FJedztLzwIxNdk\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"tXJW7akMy1kRbDEXjsswrO6hNRGCK9cFPRMQyZwuHbY\\",\\"y\\":\\"cTQyg051cByp6Xm3j4M8iCsvmxQvt5B1d6KXjn9AX8s\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"hNA2bLbEQIiAGJyVXskmr4h5GhMmiT_RglYGnCZbGzc\\",\\"y\\":\\"ec5M1xRW2T6ITWcrSE6SAGsSlPL5UGrH0eyzs1mksF4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"2PHQYBVx7XXKZYhYkqviKwWriSbVAgf6DsgIOrAi4-w\\",\\"y\\":\\"KRSe1e9DPnd0Qc9kpkD9ZdUk8mlcKi2Ib2A4i_TrQ44\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"NUFWzeNOQDB2uwSj04SBgM4XVNah5yymEvosJy4jOdY\\",\\"y\\":\\"M_5wD_LcnnqtXxpzUSaK15xG7EFbSs498oqLJ3gFBeE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"qvvGmTUKIuRkxpv2XZx7EBUL9VVRamIoeYY84MhjnPY\\",\\"y\\":\\"rJDFc9cz3hE3UQuLMnb5YZ7xuN2zhs53DDv24fvZqz0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"esigx_rJzIve9GXr3LL3AMtDrF9UVuWKYqP_vDwvcrM\\",\\"y\\":\\"v1g5r28cq_XcwKuYTxR1tK3VvuQFKCKXsQtoMGJZbEA\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"jsN4VlNPl0sdsjqdPI97nXH-T5HHh4LJLx0k61sBPdE\\",\\"y\\":\\"si1Fivjv-HfzkhYf8l4zkygVyHwKnNrjbVFTM4wtDgo\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"54H6iO643SLXTTFGuCJEELAfYeS5K2o2zAh0pScjUew\\",\\"y\\":\\"4cBitOYc5IolNr7fw9Z9aHvML-AXAtiSus2y6_BOZdc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"69keZDNWu5-Ow6WTYFZ4yfuTDG6UwMMmYbpfhZIVS44\\",\\"y\\":\\"0FB_FPrtpQ4Pq-QiUaYK910OASCxpK3TujCU_l2Ywn0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Mnm44iHbUtCVmBV-MN1BjzmRLEahlQgYgivggdszdlI\\",\\"y\\":\\"OlJL32VpwHGgIsKVvP8lrvGk3Kjjj4Uyoa6nmsu3or0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"py6vxd8mgJ0wsT215mFvDHzLdGVzVTVmkThKQXMTQAI\\",\\"y\\":\\"DedDNIrf7x3o6sLs7TYGizjO57LTn-m5nmj7ZqyiwI0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"01ZVBxQ1JIl4y8_5BCocpH3fHDqNlCw2IIRQhQQS6qw\\",\\"y\\":\\"aTTu7foFltymjpQcm68q6zHq5RILq96vSXTSWLXjyHc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"601bqAKLptAKue76HakIeMAoWc_t5rX-AeKtkiz_D30\\",\\"y\\":\\"luju7XJtqIMdi5uveAHm650ahbp5q4i9KUym-E-hW4g\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"lAt_wR-gZlsTEQWYSKLMB-nz1YDoA5PgR5PD50mTNRQ\\",\\"y\\":\\"PmjdNmNSA5gshumpbHA1ogmVX5EfAMHmdofHZxuNmP8\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"wGXDn4gPVKmRQs8VVN6W6aY0-4S89BtX5-UocbTYIfE\\",\\"y\\":\\"XyPi_LnIsz6lDtBRFptYFsuvi42EhrTPoi0PnC0FcIg\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"-1WBoAklVSwM3LZKGHiqMfy7xIUcdYstF1UvL0xZmvw\\",\\"y\\":\\"04w3MHu7ma0iUAKE8RQTReXpG2aAKLx8uZj5AbVkJt0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"-AmxPfVbHUFSojDQF6Xz-fdNrDwJxlVBNxEfdxw_rg8\\",\\"y\\":\\"BOUDDWeKO-U_ziZP8b09Kls0mlz6ck_8RLlpWBrVp30\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"loO7uh6ZFx2bcab0LXIaM6dtzDSwLub59zeCdjQesck\\",\\"y\\":\\"dyHHL_5O7bN2DmPe_jbcA_IouQVukWYgGr9XV5id3X0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"91d6CdFms2ho3QnOJGTu5KzrZcyY7dZCG3cQ3ne25QY\\",\\"y\\":\\"Is1kxRC5jv274imw78usI_-8sceHrr7Stx5LZPeVovo\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"Iym-KGQb4m7iNT9e-7MLVR_zROZ-T0sCqWPUonlJ0GA\\",\\"y\\":\\"IS6U_XNNQxFXq5ocm4pCogobasW9cn15bEmROs0fW1o\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"yDIbKPX1duuoENLTzgIXraJpEpo9hWviH-0mALKK8xc\\",\\"y\\":\\"08qubHiuYc5JGzDwT_q8N8KQAp3T9la_H9HlOax9zbo\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"y9lNiUNCJkUgPeyedXoCU8RuYCvwhlpdERusXyEjgbI\\",\\"y\\":\\"S7_vhlUpM8p3BG32hwRMsMbeoSq8rEsRFJbjA8vQwQ8\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"kLJTeX6QyCILk5vfvADJt9LIgA5wbDFBamW_HDYwOwU\\",\\"y\\":\\"_FZm-_4b3Cf9Gxs5gnRYGSCIvqZ2NCwHvvXSYSv6-IQ\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"txJtjpeZXL6j8R8NHBcmbU8pZFoUTxTI8TjUu-EsJz8\\",\\"y\\":\\"uDQCL_p06LktIHTDBbM0EXqZJMCLxYzqNx4Yd_5oFrM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"soE1TVWnVFlVrRjJLZX6raQ49Js3v9pb66UiApdT9gA\\",\\"y\\":\\"2KcLZKrNc-7aA3oGHZNzpJPZH9A5z2HbhBxNUKaBnUk\\"}"]	2026-08-08 17:35:49.698
1	599	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"pI5-kIy0v_5e58ARjsQy9EcKfawqNozQCYZJOz2Tyd4","y":"a34EvMKu6OsOS8HMUTTpyGv2AmNPCEVqDwkBIkoe29Q"}	{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"5_J0mwROT6fvHrQdUSGoqdqrMpilsyTiAdNqYykRqxc","y":"bz6WvjLd8Ig4lRy1fHLW_MOlgmLwdD3YeOH-DPCsto8"}	valid_sig_p256	["{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"SqgvNysddG2laYSaN7WtxHQisap3BC-Xl0o6tDmjXJ8\\",\\"y\\":\\"MbJXEsZN-z_OT7KSxOb-OAy7ti_EZMp8CdQJFEDRtu0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"iJj5LwH5SKAOQ9gXK85ns7NDtMB9ryAsDdTCbcIrtew\\",\\"y\\":\\"4LbP_TDoHFvt-XTiFSTj7tqP8uIunZzQqI8k1GEuFkc\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"QJncWDFB-zWJiU1b9FxciiLhRDyLP9Tez_drWnha2vE\\",\\"y\\":\\"JGP1so1OX1v8baGcTLJvMJQLXu7xuEd56dGVE5DFYtE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"frjjHPGKuXBjWh2vIUXnXnioD1iw9zaKeU21dCjAArI\\",\\"y\\":\\"B-FBrEgzPg4pujgfAU3bwcCiTUhhpFfc7D4ricrFGlU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"e-isfov1oWDb1al66nenLbci2Ce66LnoeYIL5UwLL_0\\",\\"y\\":\\"ppf039E20z-RAc_BoYQq07A5qWI9Z9yFhEcX75ihv3k\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"etP7B4gqESVWfkpWiz5Ypb1GxE_uPE8EBYWmiZoIfPY\\",\\"y\\":\\"lbSEoZlXTUQoaIs-qhyosWz0DnhBI4HdFqrsr25wHw0\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"WbKHPSPoZmEj1Yi7RlPe5xvu3a7TPhTkd2XzeTZ39Nw\\",\\"y\\":\\"C8345NceyCSckP-uHNcZ4vhwJAVRtGeFIYiJEh7oHHY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"jz87uy_zm2wKNoxexl_LIXJk8yPCYGkYjf46WTtgSlo\\",\\"y\\":\\"JaPhPB53SmUTW4OQJmuzWsrTORtSN5obuSP-UmJ45LU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"mLz5X_U92JYXBJTsBGiQUqjwzwth71SpIrCBrKZAkLI\\",\\"y\\":\\"vQDjfcr5t0cL-_l8YIcCDKbzMYOqHyfHCMtFyGJNXls\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"KXCaxV19q6GUJNMIfnHyry3d_CBRnyL8mqRmvxG1Cek\\",\\"y\\":\\"gkKmUsYpkRKjE3Db7Oe3y5AKCoqJL9_-zz_2d6Ueljs\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"iiLbiRH910lljLFl2EgNpoTGy8-LjtAjjI-Vvh5VZaA\\",\\"y\\":\\"PQlj95NHO--HGZMGxOKp7iamezd8SgmcbbmusA0F7DE\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"6VII5zUid25QfzwTz54jN38stpOKGG0yAfJtHelNPPI\\",\\"y\\":\\"mxS-awI30v_j8IU_NV5jyBiOG67RbBPLrG6d3cbqIgM\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"afLEBqvS9N5wjbDdJPA3_Cv5uI_j1A8kj_Shoxh9a3c\\",\\"y\\":\\"v0n10or-Q4BUA5Tjafle2RCsqWLeOhapUksuER2fa-Y\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"6ug2wWtchLGIuLG6JJkn8jmOdJABIcOjmnucr3dRlJI\\",\\"y\\":\\"II438OL-7e_v-LOStX6vpl6E3m8dNBY8whWH87C--UU\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"FuaFdfER8NV8ZRD-F9KzdZ7x8osiq59PUmOVY9JFRac\\",\\"y\\":\\"aR5KNGssXF-lFnQUsDSn8mF3B5mnDAU4u-Oaqa8QwQY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"tiYS__4ZqlFRrl9V5oj4pD7QpLwO2KB1f3-o_BQAv0w\\",\\"y\\":\\"it0IWL_l8G226VYjzQqtpcYYRD2EMM4AooAXrgVHnU4\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"rINDlFcL5MdIFwB5yttSwCbQxpOmfCgywJGgd8zlkas\\",\\"y\\":\\"xm3gyQQns-6B-cwh7-UhLLJU-ORebRO16rqDFY5WNJY\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"SCHrU58way3Ee-Mu8SLoUFeFuIbwaAw160l0bgVSvEk\\",\\"y\\":\\"nv_Uw74qDDOKYwUvQMrPDvvrh-yIoDnYcH0JN3zVnvg\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"VwEHqKiK3U3LU9BGArUDxj06ZEA04THZkRqCTM60cwE\\",\\"y\\":\\"cz4Lg9ks7CBn8bjf19KLJYp7nvk4mQAEXGbNvXv1u5Q\\"}","{\\"crv\\":\\"P-256\\",\\"ext\\":true,\\"key_ops\\":[],\\"kty\\":\\"EC\\",\\"x\\":\\"giutLlICeF9lR4RaPARBLu_l87aCPxWTayXgR95VKoA\\",\\"y\\":\\"m2YdN6TTRBCQwXCmif-EhdhCwdJbL7yQcYMXpgUS1AI\\"}"]	2026-08-08 06:55:34.842
\.


--
-- Data for Name: user_unread_counts; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.user_unread_counts (user_id, lounge_id, unread_count, updated_at) FROM stdin;
1	4	0	2026-08-06 15:55:21.499
1	150	0	2026-08-06 19:03:38.64449
599	3	0	2026-08-06 12:16:56.089
618	40	12	2026-08-08 07:21:19.564
599	4	0	2026-08-06 12:16:58.603
2	4	0	2026-08-06 17:00:09.673
2	3	0	2026-08-06 20:00:54.674617
599	5	0	2026-08-06 12:17:00.389
618	3	0	2026-08-06 17:01:17.025
617	156	2	2026-08-05 22:23:28.834
617	155	8	2026-08-08 08:21:51.932
599	10	0	2026-08-06 06:29:28.398
599	2	0	2026-08-06 06:29:29.322
599	9	0	2026-08-06 06:29:30.497
599	8	0	2026-08-06 06:29:31.03
599	7	0	2026-08-06 06:29:31.646
599	155	0	2026-08-08 08:25:14.76
604	157	0	2026-08-08 05:29:33.384
618	157	1	2026-08-08 05:29:39.938
599	35	0	2026-08-08 11:58:32.636
604	39	0	2026-08-08 17:34:42.985
599	158	0	2026-08-06 14:30:09.745
599	152	0	2026-08-06 14:30:17.405
604	36	0	2026-08-08 17:35:52.975
1	5	0	2026-08-06 12:20:16.396293
599	36	1	2026-08-08 17:36:04.218
1	7	0	2026-08-06 12:20:17.056574
1	8	0	2026-08-06 12:20:17.678848
1	9	0	2026-08-06 12:20:18.362769
1	2	0	2026-08-06 09:20:18.976
1	10	0	2026-08-06 12:20:19.508867
1	3	0	2026-08-06 09:20:20.368
604	156	0	2026-08-06 14:51:14.16
604	4	0	2026-08-06 14:51:26.473
604	2	0	2026-08-06 14:51:28.706
618	154	0	2026-08-06 21:23:25.077
617	154	3	2026-08-06 21:23:31.836
618	38	0	2026-08-07 22:57:59.334
599	40	0	2026-08-08 07:21:11.78
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.users (id, username, password_hash, salt, passcode_hash, panic_phrase_hash, recovery_key_hash, login_recovery_key_hash, duress_active, is_compromised, compromise_ticket_id, role, display_name, avatar_url, bio, created_at, updated_at, location, recovery_key, recovery_key_delivered) FROM stdin;
312	lexie_0_99	492b4fa4c36183209b1292ebcebe4e2995a798c63ab90737b7a991f72268bb60	71679416fc5d9f270a0f32c705c72475	\N	\N	2519afdbbab5bfd4d6b38e2313a246ef348813a240ed0523871403b2d6ee08e5	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:14.253356	2026-07-29 13:27:14.253356	\N	\N	f
314	rio_4_520	8dc7d3d9ee8bb9a6fd981c6c3e2f10b17441044378ffd696885fd3c1ba4f2b73	46ff5d2e416df40a1dbb54342fa41ea4	\N	\N	17a98d7d82c1f004587504f8b3f8a1fb5411fcf4e879de875dacb5d2b445bead	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:14.966392	2026-07-29 13:27:14.966392	\N	\N	f
315	jax_3_688	1a96ee6dac6b5861e12ca7526327ed86b73b1540491f802e1e2f05847d2e1458	03524dd53878d64c86a0e864e1ea06c2	\N	\N	73b6a83674cc2fc0fa89bd931fbb058ba586d562a4785e739f57b342fdb2ce4d	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:15.314267	2026-07-29 13:27:15.314267	\N	\N	f
316	nova_5_711	cb555f8cf7677b7bc22e7ccebe10cd8501a7d5c2a17159e1d42bb0ed575f5d88	2b9f7055add4d6995670bc11a28b4761	\N	\N	e30dac25a50505d18b5e8f0e697cdefa4e0eaa191655cba475693de4307426ff	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:15.719427	2026-07-29 13:27:15.719427	\N	\N	f
317	luna_7_624	85d70cd347705f967a2100dbf56b280b4656ce5592d8653cf3ebd9054819017e	af4c3ff8491267a108c05fe8b3d8d000	\N	\N	3180217c75caa8492dd8c04f932899ef79c6110ab3290fbbadbfce3e41ab6873	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:16.03207	2026-07-29 13:27:16.03207	\N	\N	f
318	kai_6_254	03fad1b895b5150e2393f3c40529c5e20565d577316d098c7621fc731300228d	2c0746a72a7c09217af64bda6eccf422	\N	\N	224bad0a92b19f3fec9821a9905151c9d6b09dd46856d2501f52e04aaf0b4ef4	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:16.425188	2026-07-29 13:27:16.425188	\N	\N	f
319	ace_8_216	875449323b96bcddc00b776f72577f9127d4f33c4547d556bd49f0a070ad112c	eca5db1456508943b0531b87f6e98f9c	\N	\N	f1e12a9c99bd1e689f2bab18fc7da916e14feac6ad799e1f12e7f68fd409a710	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:16.747425	2026-07-29 13:27:16.747425	\N	\N	f
320	ruby_9_812	709240cb7e3bc9e1e6902d4d6a4318b138351190b1a81efb07a673e8c42af442	c583cc1331112d12fbeaf47e014d272c	\N	\N	4bb4149a03556385f463b2877bb3a01a6d0da3ae5003cab0be66a0d8c5bd44d8	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:17.102751	2026-07-29 13:27:17.102751	\N	\N	f
322	sender_1785322663853	9268d3c55a00f461eb81fc2bf2a8ad905442bc8b37d3a7b53f0cb52044d0772b	3250a34ce54c42c490c056f9b23df0ea	\N	\N	86ca5a0e315d65390b413129815dd7c8d23527314d018d7da8882b293366fba0	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:57:44.514239	2026-07-29 13:57:44.514239	\N	\N	f
321	seller_1785322663852	d3b3e40e5cc3cee022149a4a4cb5068b72145cddf76b3e82d223d569526225ce	c00f587c500648e31b8258dfec527e06	\N	\N	928033084f2ac9ccf2665ef1ffb10e277d666c468059e5ddcca081807ae6121c	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:57:44.480244	2026-07-29 13:57:44.480244	\N	\N	f
323	user_1785322663845	7bee47af3c54d12bffe19915f3da91161c54d646650bcd45edb22ab72de647d8	97d1db44d1a9b73d8e7674d686f19949	\N	\N	448530d26d57cbfefa8a54cdd810b0f7667f553c15a99761e552cd2eacd34add	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:57:44.561065	2026-07-29 13:57:44.561065	\N	\N	f
324	recipient_1785322663853	3e610bbb4b8b96b7880e7fd92b4794b4d61bd1a9a6466f74a93b925c7f57026e	bf8a3df885c26e7965d0619a152620ba	\N	\N	55470e6dc393971501712f0f66c28184bae23f7e6ff0758f40e4e352ad25f559	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:57:45.087862	2026-07-29 13:57:45.087862	\N	\N	f
424	dual_v2_1785322886270	2c6251b3d57d6ea95485ee2af705eec37e9f4ec33509beddf1276e04b1623291	bd37ba60c8591276002a2a1de71251da	\N	\N	d950aa9c7fb71912e4b1c1d74445ce8d5dd88fa6d06fb94c4578fa5a65b92300	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 14:01:26.846606	2026-07-29 14:01:26.846606	\N	\N	f
425	midnight_1_940	5a488f294bcb124c917ea193b5553c3a1f9191ccec8784602342ee9ffaf274da	16b02b92c2daa6e3d449434c905040d7	\N	\N	be0c52082e9cd92e1b96b9c7e15fbc6e838a4c8cc6a4847de6e5fd358854a60a	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:00.12706	2026-07-29 15:01:00.12706	\N	\N	f
426	zen_2_673	da447edbcd01297c7336eb794b59afcd67440c1d8dc991e5f4ba64af1b8e0505	ef2596d72b4aa564a6bed1dad9c253ef	\N	\N	3d4074a2eb5f5bfc4235d70c6d5f4362d33ca159b7485aeb9998df0fe68ce521	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:00.450009	2026-07-29 15:01:00.450009	\N	\N	f
427	lexie_0_143	d841004b6fb65230f42c2a57a33eb27a1cd5c3ac34e8f3d994183369b25af184	cc4f52579fd7bb7029d99a47339530c2	\N	\N	ea7679c4eb071513093f00ff7eb3022a1b5f103b2d2c55500f654bdd0b770e18	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:00.808819	2026-07-29 15:01:00.808819	\N	\N	f
428	rio_4_903	aec105f4940abb7195399ca26345613e324875063fa6027c631edbf16e8f69bb	a49df97829fed2c5f4d7c7f33a75c78a	\N	\N	27c451e0b10f5b1acafeae0fc8c6e958f9f1e4517d9567c18c4fe49a3b785ed9	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:01.163381	2026-07-29 15:01:01.163381	\N	\N	f
429	jax_3_673	90051723f55ec521e5e99692a3b350253167e5d666e85bad3f0fb11d4a67b2d0	e77c75fae23171181267907ae6c9ab0d	\N	\N	46dba8ff598c5037ce5171270760f917334525d51b3ee4bf6b21d6cb18411d33	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:01.496729	2026-07-29 15:01:01.496729	\N	\N	f
430	nova_5_661	57956af1ac5c118dd5796f0a3cc945f40adcbb06871c09f0940eb0b6c290db7c	f46b470287df44ca409947807dce08a4	\N	\N	70b12994ac17de82c822d377c6ab447cbe6aef5fd29453b693e9f2d6587fe37d	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:01.817406	2026-07-29 15:01:01.817406	\N	\N	f
431	kai_6_561	67c7f159b1bd401087b7d0b0774034a6e27361a461bfa6a996b141dd3141e9ee	18f0c2ab77453eef69e768b9ff23ef4f	\N	\N	320e4ad1bf6907cbfee1027b5efd83bbe622625ad936ec95d1859e49e434198b	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:02.192158	2026-07-29 15:01:02.192158	\N	\N	f
432	luna_7_908	c233fdd5b3d7ec34b155de2a474283f1e23b7282aea295ce29645c0de9ee530e	71e6a72c213e6b64aaceedf8131b905c	\N	\N	3205051c8c32c2bea974b5c790533cad53d9a36b9e11cd2c14190312ba258b06	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:02.526734	2026-07-29 15:01:02.526734	\N	\N	f
433	ace_8_99	bcd1417daa7c0979a67953093562a213e8954276281cd29db6bf12f35e08e596	2b3995413e0f99c5d304105811f20f1c	\N	\N	81f3af0f8b173d1eedc02b2ea503e413fb479a14f668b0bf4dfc134a103bf4b1	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:02.859361	2026-07-29 15:01:02.859361	\N	\N	f
434	lexie_10_891	b9644fe9cd7a7c118117a94c57a4855d733f656ab0571becc3b452e478eb4aa3	7cab71ed440e785a2a816e605d906a02	\N	\N	ed2310a107ef6fc8f21cb4ece25a1c32425c0bcf0bef726260c904fc0e5cfb10	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:03.187938	2026-07-29 15:01:03.187938	\N	\N	f
435	ruby_9_480	4aff3bbf5590caddb376e2469a0331460473a3248cb312cc28e56aef15311f4c	a055427ea21a1ce25ed52b02319054d5	\N	\N	71379a5d39b4b78e01ca0b573a5591e8c5d3a74f6a45f130850fbc26dca803b1	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:03.547274	2026-07-29 15:01:03.547274	\N	\N	f
436	midnight_11_909	6ba8f49529fa05b3060ab82c13c2f2cf97e60ae89385989a75327918f6b0a8e6	145502cc9f5f92b2bf4be197f577faaa	\N	\N	8ece87b95a9b55abe409fa712cb7bdcbf9a0d6ce3c9fb710bf65af3c71827a86	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:03.866394	2026-07-29 15:01:03.866394	\N	\N	f
437	zen_12_706	aca54982920614c5f0277c80d0e729610632f858c5101e6bb793e2cd1df24819	5653dccfb4324e02794d17d41b572c81	\N	\N	afde6a33ee57aba8f3bf56417378114dbb69aa69b6e107499a3df17615aa589e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:04.261988	2026-07-29 15:01:04.261988	\N	\N	f
438	rio_14_94	514281892897829f740ac14f0df0fb0934d621781eea31e26fe0224f3ee52a89	972519ee03b7a375a2ac98f7313ef07b	\N	\N	78ec112c2aa1208119749a05f6a9f913930dce98d9cad5ce5be7e2e4374c3418	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:04.637818	2026-07-29 15:01:04.637818	\N	\N	f
439	jax_13_688	bbbd28b1a32666c0bdfbf9503f32b36c9f1b4ee35ccb64f3596fa93d46610fe9	6b63180d3a6aba48c32d2ef36abe9b86	\N	\N	0691d0a5e00c96f04686a525200ba65f539e0cc6dc4c1b94bf6d6508ccd0f4a9	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:05.038885	2026-07-29 15:01:05.038885	\N	\N	f
440	ace_18_485	f3dd9df63af54418ad0dd4be6185b22e3c2641a77f711071688a7e3a5c895d73	6443363fbb0f261954f885bc1575154e	\N	\N	36419108e313fd2fa42afafbccd52a470fe48cd3d12c0047f5683a543aaa37eb	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:05.447351	2026-07-29 15:01:05.447351	\N	\N	f
313	zen_2_506	c13fa09b0cc2e0c59e4602724e92945fb820ef30314fe241cc511782b8c79c69	f6bd9207f70d72d21b779bd5b138f4f9	\N	\N	ebf8b354a66a12e8960be8fc2e03b593d812095dc11fe4fa2f6c57b9251d8353	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:14.606891	2026-08-06 16:06:13.103	\N	\N	f
441	nova_15_586	b27da37b8dd7500374cfeb38c3e078dd2e84b4189b7c136008655da6b7c9fa64	d47c13ff7a94f14157da1c0542a2b68c	\N	\N	b99df7aafc312b660886b6805cac604bbb85decaa873174522585a70d4f458e8	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:05.759576	2026-07-29 15:01:05.759576	\N	\N	f
442	kai_16_296	866da7763a511c9e969f192e9e0bceb6ef94e31d4246bf00cdd4881afb92cac0	cbfb14ebbcb224bbfdea8651b3601f14	\N	\N	3e06dbf62f25892a6da0c8c3ce52daf7351cd8c1920fef9ba8992e03fd2fbaeb	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:06.134792	2026-07-29 15:01:06.134792	\N	\N	f
443	luna_17_596	ad60c8ab4edbcd7f25f231e4f72e6a4f4888033bf7facf920e39dc8dbba62428	2a3a4ce0f4546f234cac572dbf26e51f	\N	\N	232012b8762ca06179514af5a5d731eda959f3e3d8d43e559b5bf1014278e33a	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:06.491281	2026-07-29 15:01:06.491281	\N	\N	f
449	nova_25_759	08bdbd9daaf6c7f2829fa37f9220a209db5205df8123dcf762de3b8439447b10	ad9dc4438ad204603814bbfa936553bf	\N	\N	e1abd3fcd52e2effe88de28da2b0b7c7fabf30170d073c6e22b6ee884bd1c8ab	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:08.756883	2026-07-29 15:01:08.756883	\N	\N	f
453	ace_28_565	73580df996104bc322bf82fdbc089f7a9614de10c9396f58e5f3cbbac6093cc3	3a736de052566990cb53454cf77df1bb	\N	\N	829e1490ef84eec9f4292c727ad8d84659d1c32d050d105a03e438efe5b22422	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:10.221153	2026-07-29 15:01:10.221153	\N	\N	f
454	ruby_29_660	21f5357e50071876537e8c856d1fdf40cb562f3f671b360c1bfa995f2e41bee4	72df14dcde4ed079c13d6beea54627c7	\N	\N	01c2367daee1309aa0e434a0c91319f23044aa55d2f80524172dba5e633dd610	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:10.62104	2026-07-29 15:01:10.62104	\N	\N	f
444	lexie_20_802	8acdc3a3edd549335dcc6ccb4668ac118165ba86a7f255e5816cdd255d326627	fe3cf2e88798319670252e4b237b8de2	\N	\N	f104c1d472122f169eb083cf0f371c53156dae883bffb58f5c2eae83a8af9c82	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:06.796087	2026-07-29 15:01:06.796087	\N	\N	f
445	midnight_21_605	f440af4d506c7d93123abe56d08e20eb46eb8533b6aa943f1b5796148c8690d9	b424cfa43823979595156982202e099a	\N	\N	54f0f44c1c82a4f6d7b5ebe5fbcf33b70bd566bec5dec802c0a68ef709de2173	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:07.220353	2026-07-29 15:01:07.220353	\N	\N	f
446	ruby_19_319	21d972fbadbc6861b6d9fc1366ba6800e3bbf8e0ce206bd3780ca4811f34b727	3d1195fb5eb17b3625866e231ccd392c	\N	\N	4b2c5053a581ccdbfe327a74c979ac965a6d8b87c4e39a7b0fdbffe9d5d5e331	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:07.682593	2026-07-29 15:01:07.682593	\N	\N	f
456	midnight_31_679	158a08000bbe0fa910449ccb43b029dbe0cfe8b8904bd4ba0a3bf23b1c42c392	dcbedebb489b0ae332c291537d21e19c	\N	\N	36da16b0acdfef169b0738b172c70baa53247050512ea52b2a355a0aba839ecc	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:11.337282	2026-07-29 15:01:11.337282	\N	\N	f
447	zen_22_275	d2b4ebe15bc9d453bcb01565d348deea0230a3d6320634aa4ac88652a8d31884	2b1f53daccd6ea04904c43b85ad115a8	\N	\N	c8dbbd36516ed872c3837316fa180207995e3726c0f46d79ca89e23e54a9a0a7	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:08.016991	2026-07-29 15:01:08.016991	\N	\N	f
448	jax_23_726	8554e7d9020133ba88dd2d6f3e89edef14cccb56e72c5944be8b97a6d62a8100	4d05aae624d582bb10cef8d241696043	\N	\N	d63201c59d86c366f2594b63d711c263f56979746bb96f9d15119ffa46f279f7	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:08.370703	2026-07-29 15:01:08.370703	\N	\N	f
450	rio_24_491	40f0dba59c2d1518e396f33c1add812f62c85f57b3b50f86d7ecda51039d8e25	c8f862849cd6372e3dd502279c9449d0	\N	\N	5600f5fe6734b88359fb09026555bbdaf5f18efa110840a58f05634b4804c41d	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:09.180003	2026-07-29 15:01:09.180003	\N	\N	f
451	kai_26_268	fa3cfb708e69ec091f08d590bf70faec8b42d80cc3635ae80846cfda5955b11e	bd966c26122c0db095619779cd561908	\N	\N	b40c1f478264448be20a9bc54c5787eaba2045e4e31fab0ace7532b6719af423	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:09.492903	2026-07-29 15:01:09.492903	\N	\N	f
459	rio_34_103	6d69cfef83db51a03eb1e8034152d52aa71da46eedf14b422dbe8b1f1ce9846a	4ebfec51f489dde3d60daf7bc790392f	\N	\N	106717094b4662434850786fa5ed9bf87ff8702132b60a2624a465e3056d6f34	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:12.505374	2026-07-29 15:01:12.505374	\N	\N	f
452	luna_27_275	f6b636a77854c0673c686311da5386494e3cc50a77bb8e5b70bdf14beacee1ee	a8daf1eaa6c05694684ff6b1fad00a66	\N	\N	17b6d9df67529f5baae9a01a49022c56bfbe1e4c55fba5b6e64110955ccc3d4b	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:09.870014	2026-07-29 15:01:09.870014	\N	\N	f
455	lexie_30_865	063defc0c5f44dbdde4902f9a6281156c09e87e5c510761905af0639ce6da152	970e2a462699c2bbddfd1178f514ffb1	\N	\N	fdde9f3b7eae8eebae2c78ce4e9c82a94c60e6e12c112b668a2d21a0bd0ac69f	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:11.010467	2026-07-29 15:01:11.010467	\N	\N	f
457	zen_32_720	68689ced2f47852b79003c8d4801459c2c748ef8c8ff760d97bedb5aa0cfb26d	bb82590a24a66ba8b188d052bebc6a9f	\N	\N	ec1f96b12057d0816a9fdd516d6dd886af46bafb807e1a6f6412716a84d49c39	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:11.768144	2026-07-29 15:01:11.768144	\N	\N	f
458	jax_33_134	f3cb8abe28af4bf1b057c5acf78301b3fe75dac6900b2d105dc4a880f0d3532e	70f47f1b91e43f28e422d738a4348b3b	\N	\N	d4fb801910ccc0b144e438e82b588b21e3ce84205f90fd47752d0f56429ee3aa	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 15:01:12.15308	2026-07-29 15:01:12.15308	\N	\N	f
460	midnight_1_714	667d2847df70df3705d65b76aa5006887f23a69987f48a774a13362ca3e03b6f	daec9445cec2287b0a825280f9e56d77	\N	\N	c9ba15048161ebc9464c1468625052cf39587de8881c15c1fce5f5056c26992e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:26.689847	2026-07-29 16:22:26.689847	\N	\N	f
461	lexie_0_927	ab3448f09c46f49e97381d98dc340fc91c878508b4f5946612028d8066e45d82	2dec7a7edb1d9922ea2bbab4808bafeb	\N	\N	79b0d663db0ed39b9260197a18890d22c924ef5abb4d76defa2fede8145896ac	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:27.101033	2026-07-29 16:22:27.101033	\N	\N	f
462	zen_2_921	5b86a13114566116df7ebea6619a7e92ce78967a8ef770a5d294a719d0c77c69	227f1f72e26ae5d8d1b27c6851fcbe97	\N	\N	5a030e908df1a932e0df0a0eea1d88c8d884c35a57335fce2b017ae1ad98341b	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:27.494311	2026-07-29 16:22:27.494311	\N	\N	f
463	kai_6_970	cfc3e1e2f6f7dfa0f4a85f944f8f46742e01b4d197c53eb19db3beaf12317e88	12797d97c312330339537084cd82ebe9	\N	\N	446af7dbef41e4b574b6eb33c588f965d0995909d6392ab0294312891fe8ff75	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:27.839952	2026-07-29 16:22:27.839952	\N	\N	f
464	jax_3_167	4852eed01add67b8022e1bd0b33f2f7f9c416ad3df3c23217ad05a51ef659dc4	5f93dd97ec626b3b460b3dc9b8adf894	\N	\N	270c7eff7d4018725a9388c06e37f85eab9f782dd5ff08e52983ef51f526fc81	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:28.175004	2026-07-29 16:22:28.175004	\N	\N	f
465	rio_4_8	b6c6d1b5e35a3e40b697f10d5a535065355abf0b3b06c5234815517689df242f	1fcc86beb6e8e427e57eacbb4f5d3300	\N	\N	9c66024bdc80fe307fe8c2000132838988bf3353a1e8d1494e7554d3c743168f	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:28.557256	2026-07-29 16:22:28.557256	\N	\N	f
466	ruby_9_456	dad2d9921d3188dccfd866bb57e8e716f797c1faa70c4e94ff3069fd0f92e4ef	2b2ecab49b65235ec17b9137281df3ab	\N	\N	9c1aef9510997d1ec3e5453ca4dfef8d10ecfd830f369b70dedc771bd9a4c344	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:28.897681	2026-07-29 16:22:28.897681	\N	\N	f
467	nova_5_209	0db95d428c0c98c80c4e54ea01cb8bec4157f504083d6f8e950a6b52f95bb72d	c2554fe3609458a485e8137b1fd44516	\N	\N	92aa4fd06e0eca20ac439791776fc20c013aa9c9458e524aa56d9572c60858c6	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:29.23506	2026-07-29 16:22:29.23506	\N	\N	f
468	luna_7_313	fb1077fad5c975d080aaf0ec619606b4eaf1751b497d27ecc78574a5d485205a	a0d8b380c00a87e05826d2bbb7c7d82d	\N	\N	76ef51edcbd4817f6e29a931939b33625f3bf97477935b199117d95e0390857e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:29.608195	2026-07-29 16:22:29.608195	\N	\N	f
469	ace_8_816	c155b0b0182181ed3d898ae20f8068c36322010b1ff36169ed01a5f4db3ca322	5ce2bb7b60f3baec0e764b4a570f77db	\N	\N	ac5b3b1815c57a5d8afbf2b2c68d6d09b6fd5b1f96ebbaabf56e140c86d7b163	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:29.93571	2026-07-29 16:22:29.93571	\N	\N	f
470	midnight_11_723	1068786989f8fca7bbfcb7b0d292e8850a59ccdd63ec34e71d2178262001f4db	a3171ac187241b29ecc06e63ffef5b3e	\N	\N	361283f3a244e9fad2c275afefee5dd64b9126f4c6060d93f5b17488f7f3310e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:30.316958	2026-07-29 16:22:30.316958	\N	\N	f
471	jax_13_84	3ecdfd4504a9b40cabe8c138dc15a4b731c3b3c1f543406bc495da099566f8d4	59e96a1d10a4cf75b36548ced3d3187c	\N	\N	b614a36b2a586c2fbc7307fdee6896bfe497c258ee37e2cc7d361b7b6c0a803d	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:30.677933	2026-07-29 16:22:30.677933	\N	\N	f
472	lexie_10_908	e1f137ea5db4192ad0efea9d929435233aff6eb31120e922919b7e6ff792b598	037db6f65197fee054163794c14b86b7	\N	\N	cc0dcfa1c11013321e4d00d0ee4d4d6e3bb80c093b8868bd6c7363ae9b49a70d	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:30.986419	2026-07-29 16:22:30.986419	\N	\N	f
473	zen_12_120	5a844f255fcbe703f88e239487a269031fd331ec4c24acc197692f3a9624fba6	24c80edbc1ee3568fd6c0a75524c92bd	\N	\N	4d528c0cc8b2f53290d15d7248c46c4b53ce91a9cd45bcdb6480f22b9437197a	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:31.374542	2026-07-29 16:22:31.374542	\N	\N	f
474	kai_16_925	f108cb734b3caef23970934a74e88448e4a19c5380f0448a6558396981a35f10	057ad0953579d98fa695c03631978cc0	\N	\N	64e898a9b5831e3ca63c46de0e828c76535742f05e82a15a0d7183d021b51bb7	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:31.745541	2026-07-29 16:22:31.745541	\N	\N	f
475	rio_14_562	ff00925c2ee1d3db4ab9e58e04a4290abb580a9c909369e764153b0a0944689e	65044a69d552f3871571a8438b6c0589	\N	\N	6a3590c1dc3a8ab83896693363a82ca22cb8d28ececfca7a6c1c1d4b92baa0e3	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:32.084734	2026-07-29 16:22:32.084734	\N	\N	f
476	nova_15_792	9be09eff2bba8bb553a9d7d72218c78f2d402e94971901020b26e64efa3f5287	1bfba972742f233a6b0400d5dd6aaa46	\N	\N	ad31a8eeee2aac1e91f2af2ff1919248afdd5888f3a442f9b1abfa905cd9e754	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:32.468826	2026-07-29 16:22:32.468826	\N	\N	f
477	luna_17_8	7b1da1d7d93de8732d8fc057f212af4ba589af82c1fe611f18b977a1d2966695	a43ba32559fbc8d188b1730bb335a963	\N	\N	4103e5dd6786947740ffaa2a685d86db2890f71d67d3d2b25faa2f9f67dd729e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:33.01611	2026-07-29 16:22:33.01611	\N	\N	f
478	ace_18_775	3b440e765907c8322901a838a924dc9ccd0d7e37cd43d0642c91e44593341c7b	96a181e1418d9155d9840c0ca693e7be	\N	\N	0b023096ee6332db4a5a1198376ecf77b1285413a6900934d4692841d56c15c6	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:33.408925	2026-07-29 16:22:33.408925	\N	\N	f
479	ruby_19_610	f3f1561e5f01d552b56becc2dc98d67a0e9f8f8140a7ffae47f93dbda40f7d8f	cfc09ed53ba68f3bd512e010d4c21d1c	\N	\N	3fa9e333bffb80546eb1b53267d126fda9ce96dd65ef05f3cef53cc978be31ce	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:33.739968	2026-07-29 16:22:33.739968	\N	\N	f
480	lexie_20_179	87c4c4c1e6126b6afe24db4e862054038ee2caae6b8f7ab9a94851ba43cf42bf	95aef8b0a8377eaf713673aaa674b843	\N	\N	40c71e55926d17706955c20b35a210ff43970418b50869775b91f6dd601e313d	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:34.11319	2026-07-29 16:22:34.11319	\N	\N	f
481	midnight_21_427	0bf731a7d782899981bb732e9608c73884d3c5de13b533da4e2c1a059d28f840	b4ca4277eb445ff48c8532c9af9d9fdb	\N	\N	d4aba5f97e18bedfb06c2334d5aaf91118abba5e2f700a59ff9fd504789be704	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:34.423359	2026-07-29 16:22:34.423359	\N	\N	f
482	rio_24_939	c347f6ffe7390c5e32eae11e4bc48da0f93e3e82b1a4e1dfdebbbbf73e1b5806	85448385151724fe24c8e3bd0d4550cf	\N	\N	349325b0cbc988dde1dd8191f3e036b9e3d2354431a9a5b079808c9d47a8e44e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:34.856001	2026-07-29 16:22:34.856001	\N	\N	f
483	zen_22_111	afe47b223267d0d691207db6dd188fec74ad71ae08683a675ed8dffdb04fbe23	4294f907980f85bb18b49ec97d71af37	\N	\N	e5906809cbf593c36ea8ba4ddd9aea031a389a4ed496933e43a5663b9c5f832e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:35.236111	2026-07-29 16:22:35.236111	\N	\N	f
484	nova_25_183	a5c6a4bd003e2a2e4129bb37447c6ecfc57ffae9982a28edfbb5c32e0397c354	f3a13e2c4a0b8e7836d6fa047b46ae12	\N	\N	7983c1d63fc76706c0737e927d7136db855eaa5848266a42ac38656f7a18349e	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:35.608664	2026-07-29 16:22:35.608664	\N	\N	f
485	jax_23_943	e8aded0abd07318487331af504700b68039064ec78f93bbc6fc263ac9dfc8b25	1057466bf23740b4063b62685b65f704	\N	\N	aa69fc306fb40a37f6cb9268f5de958e4323aea1278e7766b21cf31f61672321	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:35.954358	2026-07-29 16:22:35.954358	\N	\N	f
486	kai_26_480	d8d9f24c01a0907e9a3a46e1e2aba1c56466c3f6bb4233d2762ed6a931564500	2048752ea0536674daeec8afe1aa2b01	\N	\N	aaac23e4eb9ab611ac82e2c59324e8bf96a51bbceda177b837524346101a4ba7	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:36.400742	2026-07-29 16:22:36.400742	\N	\N	f
487	luna_27_604	59ba2f0f4d2cad0d0aef2dfa1941af015a5333c4e898e0dbaf83323e4125bc95	9a10fd1bba38e4e78b89fee8a69af4e5	\N	\N	82179f2bcf5caf05dd9e934b08b8590eca66a21ef145b8b45af92ceb56ec4116	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:36.875865	2026-07-29 16:22:36.875865	\N	\N	f
488	ace_28_49	9d661773fc0ccd917e7d0b5c639e3a5776be1231fbefa257d4077c9f84d4d5f1	e98dc5ccd4436aaa7dd7d9522a8c513c	\N	\N	f0e1e85f32b7e904ff538f9f2151d947f02929a0aa853f74839c63d12ed06961	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:37.269315	2026-07-29 16:22:37.269315	\N	\N	f
489	ruby_29_771	dcd7016a1dcbca59f17896decf49657ac50e08f971bcce68bf64a26986872d5a	b6ac02216af88ceb513abf8fd0959cfa	\N	\N	6ff5e511c4c811f02352c228dbf36698d770a2caf2cfcb74f5df0e5edcba08f7	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:37.694468	2026-07-29 16:22:37.694468	\N	\N	f
490	lexie_30_367	1597b9279eed2626dec3666dae5d80727be1d2eb959e9ea0e96b8b8c0d31aea2	682e5a89cb3ae1529d74d18b39dda113	\N	\N	da2ce80b707442dbfb5811974b818d6cec7422dfea3635de054f583dc53905f9	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:38.058412	2026-07-29 16:22:38.058412	\N	\N	f
491	midnight_31_682	b80751b295749fd0a7a507b61befcd01fe1911a8db8b96eab50f5366abe455c0	01dbca126516d57e296046acd9e50101	\N	\N	3af13687c3035bf187281cd09d9a04f70ab369d513f64c149b644483b32bf23a	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:38.556302	2026-07-29 16:22:38.556302	\N	\N	f
492	zen_32_971	471cff34a2813b9ccafae1b12e29052402c0970bd695a74215a350ce8bbf8564	a36086d824f9d33157251310faf29e06	\N	\N	7a54ccd7e7f3eb2e6dc219d83ea9862cd5a5a195d83caf824b814f6588d8aac1	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:38.943428	2026-07-29 16:22:38.943428	\N	\N	f
493	jax_33_103	fe43df209a789f8fd8f21478a3251e414815e19618a39d395b3618b792dcaa9a	5e007a078b72598cc6d2698906fdd408	\N	\N	f753718fd9432e9eee00f403a791b29c03a7deae64710b26d576f2ff577f38d1	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:39.313609	2026-07-29 16:22:39.313609	\N	\N	f
494	rio_34_68	d339bb5b7c4eeb95854d5e206becb5f74876223b4f584d2130d6d4483c625057	500418fd454d8155a44a0a7abecbce4d	\N	\N	c9f1687b7d014f1168f1b033df6b6b8f9d6251e83e2e6d7c88af01b7c559d863	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 16:22:39.695265	2026-07-29 16:22:39.695265	\N	\N	f
495	sender_1785338526108	2ec03750419a4d2240f92cc9bdc794f91448fb541dd95fd4580f3b03edb26ff3	ebd7d4fa1db876248be0e4ab7054b29e	\N	\N	247dceae196d48112c892d635806cd8c569710a0b2d21a03829ba64aaa8c70d9	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 18:22:06.924395	2026-07-29 18:22:06.924395	\N	\N	f
496	user_1785338526105	10d5b2a936a3c92fa007468b6ba1ad6b7ef15c04be7a3fd1ebfa0e8702c0420a	be0031d5e00177bc181acde8d39da78d	\N	\N	f94c07cbf8df61ca254e1cfae8b540999549f25e6a14df22fe71d5dde0c3b1c7	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 18:22:06.977053	2026-07-29 18:22:06.977053	\N	\N	f
497	seller_1785338526098	54d674cb35f1580303a87d19107d29954a18af2aa00d4a740ba168e9fc15625d	0777e1b1f420186b0cdcbda3923ddff7	\N	\N	cbc11685139050cbf34d3459262a8f58bb739fe56c624173dc2def39f07b09f9	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 18:22:07.080665	2026-07-29 18:22:07.080665	\N	\N	f
498	recipient_1785338526108	5b31b965f37ee6e461a9d38315b3e66913396b2f80f1ab2b89a280d2026b555a	412da9589aae407947af47fcdd048d49	\N	\N	76bb4788e5c9e87229c03ed94e60ee8d74c6b58caf6e2808510e86e6a4230883	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 18:22:07.615552	2026-07-29 18:22:07.615552	\N	\N	f
598	dual_v2_1785338542822	ae90616c1c7f2752b9ee0979cab1cc662f5f84dd55a2b1467ce2d5b81acaa00e	c0aa50dd80ab177e712a3f178dd87673	\N	\N	9a6981174cad0ba2c10f505fe80d22ebfee9f04a9375b22ad32cbfc4eee92ed5	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 18:22:23.450757	2026-07-29 18:22:23.450757	\N	\N	f
600	sender_1785344974326	68c9732dc43f1a763e8c642e45cd2f2b13a83955846725303769d1caeb49acad	5d804f2afc3969cc29df7756eb98f4fe	\N	\N	00eeb674acc8a0a95b8f1cc17c5c88fa7f51f84a42ad89968488c007724af49c	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 20:09:35.901184	2026-07-29 20:09:35.901184	\N	\N	f
601	seller_1785344974318	342a4e0bbcc6fa70ddfc8919be9dff378d485ec69bb246863facb808ee52c4fb	e602524dfe315670434172c2d9cb5ab8	\N	\N	ec26d161de3e5953a0bdd50b61626906af95d1c70f404d9f95aed2c31829b060	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 20:09:36.109385	2026-07-29 20:09:36.109385	\N	\N	f
602	user_1785344974318	4f7095fcd84a17cf9af0df282f6499e3d6eee9b86e57fa8cf1455aa2baa163fa	258d50490c11cd3d0b1b1f5ae6492253	\N	\N	8721884c3d50183af4bd567fc8e65c1fd1ccbff38f2a03a58cfce0a84335c641	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 20:09:36.162525	2026-07-29 20:09:36.162525	\N	\N	f
603	recipient_1785344974326	6230c64a13bb08007d3dff9f30237d184c803f801ad896aab81ef4fa1761654e	463fb35fe95d12098a8fcb806057d55e	\N	\N	3c1f09d5f6bc018b64d5bdb462dc1387ef18f61c164dd961dc7a0f3610c239ba	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 20:09:36.912101	2026-07-29 20:09:36.912101	\N	\N	f
999	velum	system_bot_no_login	system_bot_salt	\N	\N	\N	\N	f	f	\N	ADMIN	Velum Bot	\N	\N	2026-07-30 00:42:25.330961	2026-07-30 00:42:25.330961	\N	\N	f
605	seller_1785396152226	e1084ba15eafbb693542437b9f09560da71a5d0e8946074f81486f0df438c399	d1af40627893cb6c36b76566675945e6	\N	\N	bc5b4606101c5661387c15ab61adc4ade00d85ae40d3c04a91c009f7f51d7e65	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:22:32.981834	2026-07-30 10:22:32.981834	\N	\N	f
606	user_1785396152228	dc65eb1271d4b1f083280459a8e1b3e2b98447d22128a8c3b1db4a06759cbcae	b2bbfa67a8de20fa9379f056b7d813be	\N	\N	722aa3da3afbb1be0c15718e7dbee7c5d17d68c4b38d09ea71fc50558f2c0652	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:22:33.014931	2026-07-30 10:22:33.014931	\N	\N	f
607	sender_1785396152226	f5ac8522a191920a6b4d07193863da671d6313460353d4b7453b4770412dc792	b9e4e1eaf7f70602a9b95cb519111a65	\N	\N	d877c95bdb9604affe9d3b8a67a4482238c084f0fa040c88aead7e88afd8c435	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:22:33.113923	2026-07-30 10:22:33.113923	\N	\N	f
608	recipient_1785396152226	368d21f1b7fa30414c48446241621be302fac55b3de8a1c1f5575ea2bfdee0a1	6e456c88b8abc5aa51a03e7bf4d7a58d	\N	\N	6da82be6be729cc5b16abf934ab8eb668ad12ee4857f34ae63bd0dea90437a11	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:22:33.619984	2026-07-30 10:22:33.619984	\N	\N	f
609	seller_1785396309313	8700e44bc63c861cab164feaa61d6f2eeb0e91216a63d7faecbe3be96621c271	1f00026878ea13c5e9f81933e970d109	\N	\N	601337ee814fb4728dfe8c3ed1bc3d1403f3b6090324f026c1014ba5cbcc209f	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:25:10.32938	2026-07-30 10:25:10.32938	\N	\N	f
610	sender_1785396309318	3fbd19e83290fcaa2db0e7fd7b695d87b2d2c26e853d90400571a4782e1e408a	163001dd1b3cb9e5ed123f34faec3a14	\N	\N	e8eef2c013f602efdd5bd5b23d47fbea67c86b35ff233a7d479c7977781d92e4	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:25:10.390667	2026-07-30 10:25:10.390667	\N	\N	f
611	user_1785396309312	91d6eeea46511bff25f5d6d43fc120daa72ab400118313d9cbdb1baef882fca0	c3d8d582e5ce220a0ce3be179204e743	\N	\N	855d8e5245b44425a07320603ff0f7616d1aaafc62788752dd72b6dd77dcddea	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:25:10.441547	2026-07-30 10:25:10.441547	\N	\N	f
612	recipient_1785396309318	1e5ee6ec4de5cdad44c75c3b92428f356927c9471e8d6c60c16cb04f346c93fd	707a9618f2057a1d430dc1b4ebb13892	\N	\N	2c8ba093a4b66ff94dc1effb45aea8b2c50a923b147fd02dfe83cd304f9408e4	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 10:25:11.126574	2026-07-30 10:25:11.126574	\N	\N	f
613	user_1785398421818	fd8d6aec894d51b718018b85132840ba451caaa22998b65931cd3ea5d92c3154	acc0032897b98628fbb2bde3058e32b7	\N	\N	36b9925a0f6c44fb9910bc46d23652422d0821ab98c84fd480036e6ad9cedd6d	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 11:00:22.508379	2026-07-30 11:00:22.508379	\N	\N	f
617	Seoul	7dca22cc8e061d289fa9823b4e22d73e1b67a0174ba2f538d67ba232fcb45683	3f5773b863ed462e47d3dceb4d82f155	\N	\N	\N	\N	f	f	\N	BOT	\N	\N	\N	2026-07-30 16:33:53.973673	2026-08-04 05:39:39.856	\N	\N	f
604	Tehran	8efcea50a518b7b19f499ee4cc0fd410b39be6630d15d26c1924ed482139e80e	135cef1bd32dbc9730c956c4ba8f290a	\N	e4aff3f2c873e451f9ebf12c59001c7ff940c8694bc2c69d53682d9a95dc8943	897376a41c5d83b080b3a55711f4b1368959e853fac8b69307552bd6c0ebbdec	\N	f	f	\N	USER	Tehran	charcoal		2026-07-29 23:06:49.936224	2026-08-08 17:35:49.702	\N	\N	f
2	lexie	7b03128b8689716ca2ac47b7b26d069b649fc70180f480da920d9cdb74eff4bc	f4e065ecc660b61418fc5d7bd82992d9	\N	\N	\N	\N	f	f	\N	LOGIN_ADMIN	lexie	/uploads/avatar-2-1786032262999.webp	Verified Executive Administrator.	2026-07-29 04:02:14.543938	2026-08-06 16:59:49.074	\N	\N	f
619	Jose	9c1970c7e851fa435e08f48663da758c4d2f1a14626622752b330fc7bcc94cd9	f88422f94abf280f58361b39fedb0e86	\N	14781e094f94822aac132d7d70f647d6b1be35f076ce95597d7e36806804fe81	f2e9dd80b179d1f29cf60cf738c19b2c36d00e89ca7e5b7aa4736a84d09bc92c	\N	f	f	\N	USER	\N	\N	\N	2026-08-05 20:02:49.705655	2026-08-05 17:19:14.919	\N	VEL-REC-39301	t
621	bot_1786050701532	111a3f6dcba3b5f2125a525baa31545c88e5b94a00fe6f78ac5e6024963365ab	beed4b873a70f93a4d1293585be0fd3b	\N	\N	e4506fbf3a62a49725db8c106dbded6b3c58b27d7b1715eee0238f41f89cf95e	\N	f	f	\N	USER	\N	\N	\N	2026-08-07 00:11:42.3651	2026-08-06 21:11:42.848	\N	VEL-REC-37493	t
623	sender_1786114595911	f318b8d003972d1c30f0d73adfc6c1ae4969f6aef99c939872e8addda0515ce0	eb2fd2f39664b7772c03624cbe6ba102	\N	\N	9b2825463741a5e2566d619da8202db3b77d1c4e0014ddbdbf1d07e59f85a488	\N	f	f	\N	USER	\N	\N	\N	2026-08-07 17:56:36.730178	2026-08-07 17:56:36.730178	\N	VEL-REC-58099	f
622	seller_1786114595911	92e8ce5b28b43e7c1dcc57dbd7172e370018f79cd16898d7d3b210de3318b01c	d718f013b840f1552366e0615510a44d	\N	\N	83a150538ebb06108a82d829aed1fc4ab35bef0c416aaaecf574e72d79c99dcf	\N	f	f	\N	USER	\N	\N	\N	2026-08-07 17:56:36.72866	2026-08-07 17:56:36.72866	\N	VEL-REC-53675	f
599	Iran	1d40c222304fd33aa8cfa4aad78a0e4c32a1b86706bed4e8ad2db6952ddddb18	73131393b88aab868b26caaa46fe7ad6	\N	9aa91449d2c12c639f96fb603d7c6cbc01a696a590de368d17a7c274533833ca	a8b4f1e61d337c7da9b326793fe1cbfd19dc787615be3df87e89bc26d8618181	\N	f	f	\N	USER	Iran	charcoal	👦	2026-07-29 18:36:09.803564	2026-08-08 11:58:32.492	\N	\N	f
1	midnight	6d8390125514b3f36e31378b9d850c02cfb09f77a12c8d3dd222a6bdfa2be079	698eb1bc7d71072103968966a39c3794	\N	\N	\N	\N	f	f	\N	CLI_ADMIN	midnight	/uploads/avatar-1-1785950282213.webp	Verified Executive Administrator.	2026-07-29 04:02:14.380338	2026-08-06 16:03:38.473	\N	\N	f
618	Taiwan	a027cc2c4238ecc0c70fdee2e69cc5f78549969adb3f0cf58872fb869bfc30d6	2aa48b82f213c36712bd1a04b0592fc4	\N	f2ea97739e4543f78ce05251bc4447f21be8e6d0364cec9dcc3f98b57b71ecee	361b8e8af2607755334e14cc716bd09a26b34c6370042e09d462ec7b2939a47d	\N	f	f	\N	USER	Taiwan	/uploads/avatar-618-1786039780947.webp	Whatsuppppp	2026-08-03 23:35:53.151078	2026-08-08 04:54:36.235	\N	VEL-REC-87963	t
624	recipient_1786114595911	bc1803515611e6bdf801efbfa5ea4acba4bdae390de791c46d44afc84a18c41a	3aa2865767e212c4ed664a7b84049d0d	\N	\N	816f5bc02609e20c09be8af6620e67f02fe9d82d84adf2aefb981f5289cdc69a	\N	f	f	\N	USER	\N	\N	\N	2026-08-07 17:56:37.209015	2026-08-07 17:56:37.209015	\N	VEL-REC-98796	f
625	user_1786114597273	ec24fee311e18179491434e90566efecbc8f8015b8cf0dd62c13a697bfb5ca8e	407c2a3f7484b64c654124da4dd7ebac	\N	\N	1c6677b94b7e06fce842f43de547b0c99cd7834775cd1a2f8d199566c50b9b27	\N	f	f	\N	USER	\N	\N	\N	2026-08-07 17:56:37.990253	2026-08-07 14:56:38.471	\N	VEL-REC-24068	t
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.wallets (id, user_id, balance, currency, created_at, updated_at) FROM stdin;
94	599	75.21	EUR	2026-07-30 03:55:15.57309	2026-07-30 05:51:42.37
95	599	150.00	TWD	2026-07-30 04:03:11.448375	2026-07-30 06:57:34.674
92	599	13.59	VLM	2026-07-30 03:55:15.544652	2026-07-30 06:57:34.689
104	607	0.00	USD	2026-07-30 10:22:33.739556	2026-07-30 10:22:33.739556
107	604	0.00	GBP	2026-07-30 16:14:38.970117	2026-07-30 16:14:38.970117
108	604	0.00	CNY	2026-07-30 16:14:38.995519	2026-07-30 16:14:38.995519
109	604	0.00	TWD	2026-07-30 16:14:39.004914	2026-07-30 16:14:39.004914
110	604	0.00	CAD	2026-07-30 16:14:39.014209	2026-07-30 16:14:39.014209
111	604	0.00	AUD	2026-07-30 16:14:39.021373	2026-07-30 16:14:39.021373
112	604	0.00	CHF	2026-07-30 16:14:39.029022	2026-07-30 16:14:39.029022
113	604	0.00	SGD	2026-07-30 16:14:39.045979	2026-07-30 16:14:39.045979
114	604	0.00	HKD	2026-07-30 16:14:39.055851	2026-07-30 16:14:39.055851
115	617	0.00	VLM	2026-07-30 22:31:00.819591	2026-07-30 22:31:00.819591
116	617	0.00	USD	2026-07-30 22:31:00.84999	2026-07-30 22:31:00.84999
117	617	0.00	EUR	2026-07-30 22:31:00.866476	2026-07-30 22:31:00.866476
118	617	0.00	GBP	2026-07-30 22:31:00.875543	2026-07-30 22:31:00.875543
119	617	0.00	JPY	2026-07-30 22:31:00.88153	2026-07-30 22:31:00.88153
120	617	0.00	CNY	2026-07-30 22:31:00.888054	2026-07-30 22:31:00.888054
121	617	0.00	TWD	2026-07-30 22:31:00.89551	2026-07-30 22:31:00.89551
122	617	0.00	CAD	2026-07-30 22:31:00.902499	2026-07-30 22:31:00.902499
123	617	0.00	AUD	2026-07-30 22:31:00.908122	2026-07-30 22:31:00.908122
124	617	0.00	CHF	2026-07-30 22:31:00.915959	2026-07-30 22:31:00.915959
125	617	0.00	SGD	2026-07-30 22:31:00.920863	2026-07-30 22:31:00.920863
126	617	0.00	HKD	2026-07-30 22:31:00.926938	2026-07-30 22:31:00.926938
127	618	0.00	VLM	2026-08-04 01:24:55.065192	2026-08-04 01:24:55.065192
128	618	0.00	USD	2026-08-04 01:24:55.105059	2026-08-04 01:24:55.105059
129	618	0.00	EUR	2026-08-04 01:24:55.121362	2026-08-04 01:24:55.121362
130	618	0.00	GBP	2026-08-04 01:24:55.132815	2026-08-04 01:24:55.132815
131	618	0.00	JPY	2026-08-04 01:24:55.143675	2026-08-04 01:24:55.143675
132	618	0.00	CNY	2026-08-04 01:24:55.15349	2026-08-04 01:24:55.15349
133	618	0.00	TWD	2026-08-04 01:24:55.164627	2026-08-04 01:24:55.164627
134	618	0.00	CAD	2026-08-04 01:24:55.172528	2026-08-04 01:24:55.172528
135	618	0.00	AUD	2026-08-04 01:24:55.179352	2026-08-04 01:24:55.179352
136	618	0.00	CHF	2026-08-04 01:24:55.189522	2026-08-04 01:24:55.189522
137	618	0.00	SGD	2026-08-04 01:24:55.19684	2026-08-04 01:24:55.19684
138	618	0.00	HKD	2026-08-04 01:24:55.20227	2026-08-04 01:24:55.20227
88	604	0.00	VLM	2026-07-30 01:56:04.837913	2026-07-30 01:56:04.837913
90	604	0.00	EUR	2026-07-30 01:56:04.893555	2026-07-30 01:56:04.893555
91	604	123.00	JPY	2026-07-30 03:53:52.242232	2026-07-30 00:53:52.283
3	312	1000.00	USD	2026-07-29 13:27:15.404905	2026-07-29 10:27:16.777
4	313	1000.00	USD	2026-07-29 13:27:16.078756	2026-07-29 10:27:16.794
5	316	1000.00	USD	2026-07-29 13:27:17.125919	2026-07-29 10:27:17.192
6	314	1000.00	USD	2026-07-29 13:27:17.127081	2026-07-29 10:27:17.194
8	317	1000.00	USD	2026-07-29 13:27:17.140979	2026-07-29 10:27:17.221
9	315	1000.00	USD	2026-07-29 13:27:17.144922	2026-07-29 10:27:17.222
10	318	1000.00	USD	2026-07-29 13:27:17.146145	2026-07-29 10:27:17.224
11	319	1000.00	USD	2026-07-29 13:27:17.147836	2026-07-29 10:27:17.232
12	320	1000.00	USD	2026-07-29 13:27:17.259682	2026-07-29 10:27:17.295
13	322	0.00	USD	2026-07-29 13:57:45.174496	2026-07-29 13:57:45.174496
14	426	1000.00	USD	2026-07-29 15:01:02.551275	2026-07-29 12:01:04.282
15	428	1000.00	USD	2026-07-29 15:01:03.218349	2026-07-29 12:01:04.319
16	429	1000.00	USD	2026-07-29 15:01:03.872634	2026-07-29 12:01:04.324
17	430	1000.00	USD	2026-07-29 15:01:03.875496	2026-07-29 12:01:04.325
18	431	1000.00	USD	2026-07-29 15:01:03.902903	2026-07-29 12:01:04.672
19	432	1000.00	USD	2026-07-29 15:01:04.288833	2026-07-29 12:01:05.066
20	434	1000.00	USD	2026-07-29 15:01:04.323143	2026-07-29 12:01:05.107
21	433	1000.00	USD	2026-07-29 15:01:04.324039	2026-07-29 12:01:05.109
22	435	1000.00	USD	2026-07-29 15:01:04.684326	2026-07-29 12:01:05.79
23	438	1000.00	USD	2026-07-29 15:01:05.790842	2026-07-29 12:01:07.263
24	436	1000.00	USD	2026-07-29 15:01:05.807495	2026-07-29 12:01:07.271
25	437	1000.00	USD	2026-07-29 15:01:06.492551	2026-07-29 12:01:07.331
26	441	1000.00	USD	2026-07-29 15:01:07.263147	2026-07-29 12:01:08.42
27	440	1000.00	USD	2026-07-29 15:01:07.279737	2026-07-29 12:01:08.761
28	442	1000.00	USD	2026-07-29 15:01:07.322673	2026-07-29 12:01:08.798
29	439	1000.00	USD	2026-07-29 15:01:07.681947	2026-07-29 12:01:08.808
30	443	1000.00	USD	2026-07-29 15:01:08.381066	2026-07-29 12:01:08.846
31	445	1000.00	USD	2026-07-29 15:01:08.771119	2026-07-29 12:01:09.528
32	447	1000.00	USD	2026-07-29 15:01:08.851513	2026-07-29 12:01:10.26
33	446	1000.00	USD	2026-07-29 15:01:08.853167	2026-07-29 12:01:10.263
34	444	1000.00	USD	2026-07-29 15:01:09.181343	2026-07-29 12:01:10.284
35	448	1000.00	USD	2026-07-29 15:01:09.521857	2026-07-29 12:01:10.656
36	449	1000.00	USD	2026-07-29 15:01:09.914638	2026-07-29 12:01:11.355
37	451	1000.00	USD	2026-07-29 15:01:10.655122	2026-07-29 12:01:12.151
38	450	1000.00	USD	2026-07-29 15:01:10.661524	2026-07-29 12:01:12.155
39	452	1000.00	USD	2026-07-29 15:01:11.359599	2026-07-29 12:01:12.51
40	453	1000.00	USD	2026-07-29 15:01:12.150736	2026-07-29 12:01:12.608
41	454	1000.00	USD	2026-07-29 15:01:12.500585	2026-07-29 12:01:12.644
42	455	1000.00	USD	2026-07-29 15:01:12.546812	2026-07-29 12:01:12.671
43	425	1000.00	USD	2026-07-29 15:01:12.551443	2026-07-29 12:01:12.672
44	456	1000.00	USD	2026-07-29 15:01:12.566029	2026-07-29 12:01:12.678
45	427	1000.00	USD	2026-07-29 15:01:12.613178	2026-07-29 12:01:12.691
46	458	1000.00	USD	2026-07-29 15:01:12.645951	2026-07-29 12:01:12.714
47	457	1000.00	USD	2026-07-29 15:01:12.647282	2026-07-29 12:01:12.715
48	459	1000.00	USD	2026-07-29 15:01:12.705499	2026-07-29 12:01:12.775
49	461	1000.00	USD	2026-07-29 16:22:28.565982	2026-07-29 13:22:29.283
50	462	1000.00	USD	2026-07-29 16:22:29.252248	2026-07-29 13:22:29.987
51	463	1000.00	USD	2026-07-29 16:22:29.281807	2026-07-29 13:22:30.344
52	465	1000.00	USD	2026-07-29 16:22:29.956277	2026-07-29 13:22:31.014
53	464	1000.00	USD	2026-07-29 16:22:30.681578	2026-07-29 13:22:31.746
54	468	1000.00	USD	2026-07-29 16:22:31.01593	2026-07-29 13:22:31.773
55	469	1000.00	USD	2026-07-29 16:22:31.050133	2026-07-29 13:22:31.784
56	466	1000.00	USD	2026-07-29 16:22:31.068808	2026-07-29 13:22:32.132
57	467	1000.00	USD	2026-07-29 16:22:31.06938	2026-07-29 13:22:32.135
58	470	1000.00	USD	2026-07-29 16:22:31.748714	2026-07-29 13:22:32.502
59	471	1000.00	USD	2026-07-29 16:22:31.772714	2026-07-29 13:22:32.53
60	472	1000.00	USD	2026-07-29 16:22:32.093535	2026-07-29 13:22:32.542
61	473	1000.00	USD	2026-07-29 16:22:32.500219	2026-07-29 13:22:33.781
62	474	1000.00	USD	2026-07-29 16:22:32.54169	2026-07-29 13:22:34.492
63	476	1000.00	USD	2026-07-29 16:22:33.785343	2026-07-29 13:22:34.916
64	478	1000.00	USD	2026-07-29 16:22:35.259359	2026-07-29 13:22:36.891
65	479	1000.00	USD	2026-07-29 16:22:35.276926	2026-07-29 13:22:36.92
66	480	1000.00	USD	2026-07-29 16:22:35.613013	2026-07-29 13:22:36.93
67	481	1000.00	USD	2026-07-29 16:22:35.955443	2026-07-29 13:22:37.268
68	482	1000.00	USD	2026-07-29 16:22:36.887681	2026-07-29 13:22:38.023
69	483	1000.00	USD	2026-07-29 16:22:37.693485	2026-07-29 13:22:38.937
70	484	1000.00	USD	2026-07-29 16:22:38.032852	2026-07-29 13:22:39.28
71	485	1000.00	USD	2026-07-29 16:22:38.055691	2026-07-29 13:22:39.298
72	486	1000.00	USD	2026-07-29 16:22:38.553486	2026-07-29 13:22:39.666
73	487	1000.00	USD	2026-07-29 16:22:39.306082	2026-07-29 13:22:39.733
74	488	1000.00	USD	2026-07-29 16:22:39.678842	2026-07-29 13:22:39.767
75	489	1000.00	USD	2026-07-29 16:22:39.726114	2026-07-29 13:22:39.816
76	460	1000.00	USD	2026-07-29 16:22:39.727757	2026-07-29 13:22:39.817
77	475	1000.00	USD	2026-07-29 16:22:39.75067	2026-07-29 13:22:39.84
78	477	1000.00	USD	2026-07-29 16:22:39.766928	2026-07-29 13:22:39.852
79	491	1000.00	USD	2026-07-29 16:22:39.79175	2026-07-29 13:22:39.866
80	490	1000.00	USD	2026-07-29 16:22:39.794552	2026-07-29 13:22:39.869
81	492	1000.00	USD	2026-07-29 16:22:39.838205	2026-07-29 13:22:39.903
82	493	1000.00	USD	2026-07-29 16:22:39.866364	2026-07-29 13:22:39.946
83	494	1000.00	USD	2026-07-29 16:22:39.884043	2026-07-29 13:22:39.966
84	495	0.00	USD	2026-07-29 18:22:07.809764	2026-07-29 18:22:07.809764
86	600	0.00	USD	2026-07-29 20:09:37.014398	2026-07-29 20:09:37.014398
87	604	1670.00	USD	2026-07-29 23:07:10.449979	2026-07-29 22:21:45.875
85	599	0.00	USD	2026-07-29 18:37:15.716779	2026-07-30 05:51:42.378
96	599	0.00	GBP	2026-07-30 09:56:55.814459	2026-07-30 09:56:55.814459
97	599	0.00	JPY	2026-07-30 09:56:55.856468	2026-07-30 09:56:55.856468
98	599	0.00	CNY	2026-07-30 09:56:55.86511	2026-07-30 09:56:55.86511
99	599	0.00	CAD	2026-07-30 09:56:55.886579	2026-07-30 09:56:55.886579
100	599	0.00	AUD	2026-07-30 09:56:55.902858	2026-07-30 09:56:55.902858
101	599	0.00	CHF	2026-07-30 09:56:55.913347	2026-07-30 09:56:55.913347
102	599	0.00	SGD	2026-07-30 09:56:55.920682	2026-07-30 09:56:55.920682
103	599	0.00	HKD	2026-07-30 09:56:55.933444	2026-07-30 09:56:55.933444
105	610	0.00	USD	2026-07-30 10:25:11.261024	2026-07-30 10:25:11.261024
139	623	0.00	USD	2026-08-07 17:56:37.305893	2026-08-07 17:56:37.305893
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: u0_a345
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 95, true);


--
-- Name: cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.cards_id_seq', 8, true);


--
-- Name: devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.devices_id_seq', 1, false);


--
-- Name: escrows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.escrows_id_seq', 1, false);


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.exchange_rates_id_seq', 132, true);


--
-- Name: ip_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.ip_addresses_id_seq', 1, false);


--
-- Name: listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.listings_id_seq', 14, true);


--
-- Name: lounge_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.lounge_members_id_seq', 5, true);


--
-- Name: lounges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.lounges_id_seq', 164, true);


--
-- Name: message_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.message_reactions_id_seq', 6, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.messages_id_seq', 820, true);


--
-- Name: outbox_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.outbox_events_id_seq', 1, false);


--
-- Name: relationships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.relationships_id_seq', 9, true);


--
-- Name: reserves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.reserves_id_seq', 39, true);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.sessions_id_seq', 484, true);


--
-- Name: support_admin_nominations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.support_admin_nominations_id_seq', 1, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.tickets_id_seq', 2, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.transactions_id_seq', 93, true);


--
-- Name: user_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.user_devices_id_seq', 1, false);


--
-- Name: user_prekeys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.user_prekeys_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.users_id_seq', 625, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.wallets_id_seq', 139, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: u0_a345
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_log_id_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_log_id_unique UNIQUE (log_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cards cards_card_token_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_card_token_unique UNIQUE (card_token);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: cards cards_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_user_id_unique UNIQUE (user_id);


--
-- Name: devices devices_device_id_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_device_id_unique UNIQUE (device_id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: escrows escrows_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: ip_addresses ip_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_pkey PRIMARY KEY (id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: lounge_members lounge_members_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounge_members
    ADD CONSTRAINT lounge_members_pkey PRIMARY KEY (id);


--
-- Name: lounges lounges_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_pkey PRIMARY KEY (id);


--
-- Name: lounges lounges_slug_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_slug_unique UNIQUE (slug);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: relationships relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_pkey PRIMARY KEY (id);


--
-- Name: reserves reserves_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.reserves
    ADD CONSTRAINT reserves_pkey PRIMARY KEY (id);


--
-- Name: reserves reserves_reserve_type_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.reserves
    ADD CONSTRAINT reserves_reserve_type_unique UNIQUE (reserve_type);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash);


--
-- Name: support_admin_nominations support_admin_nominations_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.support_admin_nominations
    ADD CONSTRAINT support_admin_nominations_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_reference_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_reference_unique UNIQUE (reference);


--
-- Name: message_reactions unique_message_user_emoji; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT unique_message_user_emoji UNIQUE (message_id, user_id, emoji);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_prekeys user_prekeys_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_prekeys
    ADD CONSTRAINT user_prekeys_pkey PRIMARY KEY (id);


--
-- Name: user_prekeys user_prekeys_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_prekeys
    ADD CONSTRAINT user_prekeys_user_id_unique UNIQUE (user_id);


--
-- Name: user_unread_counts user_unread_counts_user_id_lounge_id_pk; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_unread_counts
    ADD CONSTRAINT user_unread_counts_user_id_lounge_id_pk PRIMARY KEY (user_id, lounge_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: idx_cards_token; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_cards_token ON public.cards USING btree (card_token);


--
-- Name: idx_cards_user_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_cards_user_id ON public.cards USING btree (user_id);


--
-- Name: idx_devices_device_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_devices_device_id ON public.devices USING btree (device_id);


--
-- Name: idx_devices_fingerprint; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_devices_fingerprint ON public.devices USING btree (device_fingerprint);


--
-- Name: idx_escrows_buyer_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_escrows_buyer_id ON public.escrows USING btree (buyer_id);


--
-- Name: idx_escrows_listing_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_escrows_listing_id ON public.escrows USING btree (listing_id);


--
-- Name: idx_escrows_seller_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_escrows_seller_id ON public.escrows USING btree (seller_id);


--
-- Name: idx_exchange_rates_pair; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_exchange_rates_pair ON public.exchange_rates USING btree (base_currency, quote_currency);


--
-- Name: idx_ip_addresses_ip; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_ip_addresses_ip ON public.ip_addresses USING btree (ip_address);


--
-- Name: idx_ip_addresses_user_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_ip_addresses_user_id ON public.ip_addresses USING btree (user_id);


--
-- Name: idx_listings_category; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_listings_category ON public.listings USING btree (category);


--
-- Name: idx_listings_seller_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_listings_seller_id ON public.listings USING btree (seller_id);


--
-- Name: idx_lounge_members_lounge_user; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_lounge_members_lounge_user ON public.lounge_members USING btree (lounge_id, user_id);


--
-- Name: idx_lounges_last_message_at; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_lounges_last_message_at ON public.lounges USING btree (last_message_at);


--
-- Name: idx_lounges_owner_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_lounges_owner_id ON public.lounges USING btree (owner_id);


--
-- Name: idx_lounges_parent_lounge_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_lounges_parent_lounge_id ON public.lounges USING btree (parent_lounge_id);


--
-- Name: idx_lounges_slug; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_lounges_slug ON public.lounges USING btree (slug);


--
-- Name: idx_message_reactions_message; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_message_reactions_message ON public.message_reactions USING btree (message_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_lounge_created; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_lounge_created ON public.messages USING btree (lounge_id, created_at);


--
-- Name: idx_messages_lounge_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_lounge_id ON public.messages USING btree (lounge_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_nominations_status; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_nominations_status ON public.support_admin_nominations USING btree (status);


--
-- Name: idx_nominations_user; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_nominations_user ON public.support_admin_nominations USING btree (nominated_user_id);


--
-- Name: idx_relationships_status; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_relationships_status ON public.relationships USING btree (status);


--
-- Name: idx_relationships_user_friend; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_relationships_user_friend ON public.relationships USING btree (user_id, friend_id);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_sessions_expires_at ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: idx_tx_created_at; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_tx_created_at ON public.transactions USING btree (created_at);


--
-- Name: idx_tx_wallet_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_tx_wallet_id ON public.transactions USING btree (wallet_id);


--
-- Name: idx_user_devices_device_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_user_devices_device_id ON public.user_devices USING btree (device_id);


--
-- Name: idx_user_devices_user_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_user_devices_user_id ON public.user_devices USING btree (user_id);


--
-- Name: idx_user_prekeys_user_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_user_prekeys_user_id ON public.user_prekeys USING btree (user_id);


--
-- Name: idx_user_unread_counts_lounge; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_user_unread_counts_lounge ON public.user_unread_counts USING btree (lounge_id);


--
-- Name: idx_user_unread_counts_user; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_user_unread_counts_user ON public.user_unread_counts USING btree (user_id);


--
-- Name: idx_wallets_user_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_wallets_user_id ON public.wallets USING btree (user_id);


--
-- Name: cards cards_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: escrows escrows_buyer_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_buyer_id_users_id_fk FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: escrows escrows_listing_id_listings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_listing_id_listings_id_fk FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: escrows escrows_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.escrows
    ADD CONSTRAINT escrows_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ip_addresses ip_addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.ip_addresses
    ADD CONSTRAINT ip_addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lounge_members lounge_members_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounge_members
    ADD CONSTRAINT lounge_members_lounge_id_lounges_id_fk FOREIGN KEY (lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: lounge_members lounge_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounge_members
    ADD CONSTRAINT lounge_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lounges lounges_last_message_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_last_message_sender_id_users_id_fk FOREIGN KEY (last_message_sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lounges lounges_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lounges lounges_parent_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.lounges
    ADD CONSTRAINT lounges_parent_lounge_id_lounges_id_fk FOREIGN KEY (parent_lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_message_id_messages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_messages_id_fk FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_lounge_id_lounges_id_fk FOREIGN KEY (lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: relationships relationships_friend_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_friend_id_users_id_fk FOREIGN KEY (friend_id) REFERENCES public.users(id);


--
-- Name: relationships relationships_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.relationships
    ADD CONSTRAINT relationships_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_admin_nominations support_admin_nominations_nominated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.support_admin_nominations
    ADD CONSTRAINT support_admin_nominations_nominated_by_users_id_fk FOREIGN KEY (nominated_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_admin_nominations support_admin_nominations_nominated_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.support_admin_nominations
    ADD CONSTRAINT support_admin_nominations_nominated_user_id_users_id_fk FOREIGN KEY (nominated_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_wallet_id_wallets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_wallet_id_wallets_id_fk FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: user_devices user_devices_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_prekeys user_prekeys_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_prekeys
    ADD CONSTRAINT user_prekeys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_unread_counts user_unread_counts_lounge_id_lounges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_unread_counts
    ADD CONSTRAINT user_unread_counts_lounge_id_lounges_id_fk FOREIGN KEY (lounge_id) REFERENCES public.lounges(id) ON DELETE CASCADE;


--
-- Name: user_unread_counts user_unread_counts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_unread_counts
    ADD CONSTRAINT user_unread_counts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: u0_a345
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict ZlPI4Xc9eu6iLHQyCshIpLjvuo4wCfgpNpMNBVyM5O20wCn4LqnCmhsRmuJoxKg

