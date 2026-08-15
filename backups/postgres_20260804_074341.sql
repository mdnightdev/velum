--
-- PostgreSQL database dump
--

\restrict oFCnI09HiR6avvfsZIg1hlTjdh0IVsKBKqP37bWAZDdWQTDfqml6hSTpUueBkUh

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
    avatar_url character varying(512)
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
    read_by text DEFAULT ''::text
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
13	615	Test Software License Key	Verified license key for testing purposes.	30.00	Software	10	f	KEY-12345-ABCDE	ACTIVE	2026-07-30 11:00:22.84188	2026-07-30 08:00:22.988
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

COPY public.lounges (id, slug, name, description, owner_id, parent_lounge_id, is_official, is_system, is_private, is_hidden, invite_code, access_level, type, last_message_at, created_at, updated_at, avatar_url) FROM stdin;
1	velum_master_lounge	Velum Lounge	Official Velum Master Network Lounge	\N	\N	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:24.995148	2026-07-29 13:02:24.995148	\N
2	velum_general	General	Main community chat & general discussion	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.026172	2026-07-29 13:02:25.026172	\N
3	velum_market	Marketplace	Official trading & commerce discussions	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.05238	2026-07-29 13:02:25.05238	\N
4	velum_escrow	Escrow Operations	Escrow status & secure trade support	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.071622	2026-07-29 13:02:25.071622	\N
5	velum_offtopic	Offtopic	Casual banter, games, & off-topic chatter	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.09744	2026-07-29 13:02:25.09744	\N
7	velum_bugs	Bug Reports	Report system bugs & technical issues	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.138308	2026-07-29 13:02:25.138308	\N
8	velum_support	Support	Velum customer support & ticket assistance	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.188824	2026-07-29 13:02:25.188824	\N
9	velum_suggestions	Suggestions	Propose new features & platform improvements	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.209573	2026-07-29 13:02:25.209573	\N
10	velum_events	Live Events	Community events & scheduled discussions	\N	1	t	t	f	f	\N	ALL	official	\N	2026-07-29 13:02:25.230714	2026-07-29 13:02:25.230714	\N
12	velum_announcements	Announcements	Official Velum platform updates & news	\N	1	t	t	f	f	\N	ANNOUNCE	official	\N	2026-07-29 13:02:25.253159	2026-07-29 13:02:25.253159	\N
13	velum_executives	Executive Lounge	Restricted executive & governance channel	\N	1	t	t	t	t	\N	EXEC_ONLY	private_sublounge	\N	2026-07-29 13:02:25.273234	2026-07-29 13:02:25.273234	\N
35	dm_velum_599	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 01:02:06.920849	2026-07-30 01:02:06.920849	\N
36	dm_599_604	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 20:32:13.288099	2026-07-30 20:32:13.288099	\N
37	dm_velum_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-07-30 22:31:21.424555	2026-07-30 22:31:21.424555	\N
38	dm_velum_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-03 23:36:11.075144	2026-08-03 23:36:11.075144	\N
39	dm_velum_604	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-03 23:39:03.728653	2026-08-03 23:39:03.728653	\N
40	dm_599_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 01:34:50.111866	2026-08-04 01:34:50.111866	\N
41	lounge_1785796684037	CHINA	Chinese	599	\N	f	f	t	f	\N	ALL	user_created	\N	2026-08-04 01:38:04.040303	2026-08-04 01:38:04.040303	\N
42	dm_velum_311	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.199684	2026-08-04 02:12:00.199684	\N
43	dm_velum_312	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.219013	2026-08-04 02:12:00.219013	\N
44	dm_velum_313	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.245218	2026-08-04 02:12:00.245218	\N
45	dm_velum_314	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.286445	2026-08-04 02:12:00.286445	\N
46	dm_velum_315	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.310217	2026-08-04 02:12:00.310217	\N
47	dm_velum_316	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.392889	2026-08-04 02:12:00.392889	\N
48	dm_velum_317	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.415933	2026-08-04 02:12:00.415933	\N
49	dm_velum_318	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.427149	2026-08-04 02:12:00.427149	\N
50	dm_velum_319	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.436645	2026-08-04 02:12:00.436645	\N
51	dm_velum_320	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.44668	2026-08-04 02:12:00.44668	\N
52	dm_velum_322	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.456474	2026-08-04 02:12:00.456474	\N
53	dm_velum_321	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.46627	2026-08-04 02:12:00.46627	\N
54	dm_velum_323	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.476251	2026-08-04 02:12:00.476251	\N
55	dm_velum_324	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.486046	2026-08-04 02:12:00.486046	\N
56	dm_velum_424	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.495185	2026-08-04 02:12:00.495185	\N
57	dm_velum_425	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.504744	2026-08-04 02:12:00.504744	\N
58	dm_velum_426	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.514734	2026-08-04 02:12:00.514734	\N
59	dm_velum_427	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.524229	2026-08-04 02:12:00.524229	\N
60	dm_velum_428	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.534172	2026-08-04 02:12:00.534172	\N
61	dm_velum_429	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.543528	2026-08-04 02:12:00.543528	\N
62	dm_velum_430	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.558497	2026-08-04 02:12:00.558497	\N
63	dm_velum_431	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.569485	2026-08-04 02:12:00.569485	\N
64	dm_velum_432	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.578893	2026-08-04 02:12:00.578893	\N
65	dm_velum_433	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.588139	2026-08-04 02:12:00.588139	\N
66	dm_velum_434	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.594797	2026-08-04 02:12:00.594797	\N
67	dm_velum_435	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.604709	2026-08-04 02:12:00.604709	\N
68	dm_velum_436	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.614581	2026-08-04 02:12:00.614581	\N
69	dm_velum_437	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.624631	2026-08-04 02:12:00.624631	\N
70	dm_velum_438	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.632012	2026-08-04 02:12:00.632012	\N
71	dm_velum_439	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.64169	2026-08-04 02:12:00.64169	\N
72	dm_velum_440	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.652131	2026-08-04 02:12:00.652131	\N
73	dm_velum_2	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.662394	2026-08-04 02:12:00.662394	\N
74	dm_velum_441	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.674257	2026-08-04 02:12:00.674257	\N
75	dm_velum_442	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.680991	2026-08-04 02:12:00.680991	\N
76	dm_velum_443	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.690572	2026-08-04 02:12:00.690572	\N
77	dm_velum_449	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.700902	2026-08-04 02:12:00.700902	\N
78	dm_velum_453	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.710829	2026-08-04 02:12:00.710829	\N
79	dm_velum_454	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.720893	2026-08-04 02:12:00.720893	\N
80	dm_velum_444	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.733549	2026-08-04 02:12:00.733549	\N
81	dm_velum_445	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.743725	2026-08-04 02:12:00.743725	\N
82	dm_velum_446	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.75399	2026-08-04 02:12:00.75399	\N
83	dm_velum_456	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.761375	2026-08-04 02:12:00.761375	\N
84	dm_velum_447	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.771889	2026-08-04 02:12:00.771889	\N
85	dm_velum_448	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.782181	2026-08-04 02:12:00.782181	\N
86	dm_velum_450	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.792021	2026-08-04 02:12:00.792021	\N
87	dm_velum_451	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.802398	2026-08-04 02:12:00.802398	\N
88	dm_velum_459	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.812219	2026-08-04 02:12:00.812219	\N
89	dm_velum_452	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.822147	2026-08-04 02:12:00.822147	\N
90	dm_velum_455	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.832636	2026-08-04 02:12:00.832636	\N
91	dm_velum_457	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.843151	2026-08-04 02:12:00.843151	\N
92	dm_velum_458	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.853024	2026-08-04 02:12:00.853024	\N
93	dm_velum_460	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.862919	2026-08-04 02:12:00.862919	\N
94	dm_velum_461	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.872717	2026-08-04 02:12:00.872717	\N
95	dm_velum_462	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.883011	2026-08-04 02:12:00.883011	\N
96	dm_velum_463	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.893166	2026-08-04 02:12:00.893166	\N
97	dm_velum_464	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.902641	2026-08-04 02:12:00.902641	\N
98	dm_velum_465	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.91327	2026-08-04 02:12:00.91327	\N
99	dm_velum_466	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.923221	2026-08-04 02:12:00.923221	\N
100	dm_velum_467	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.935	2026-08-04 02:12:00.935	\N
101	dm_velum_468	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.943523	2026-08-04 02:12:00.943523	\N
102	dm_velum_469	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.953585	2026-08-04 02:12:00.953585	\N
103	dm_velum_470	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.963654	2026-08-04 02:12:00.963654	\N
104	dm_velum_471	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.974087	2026-08-04 02:12:00.974087	\N
105	dm_velum_472	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.984625	2026-08-04 02:12:00.984625	\N
106	dm_velum_473	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:00.997106	2026-08-04 02:12:00.997106	\N
107	dm_velum_474	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.004984	2026-08-04 02:12:01.004984	\N
108	dm_velum_475	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.011566	2026-08-04 02:12:01.011566	\N
109	dm_velum_476	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.020089	2026-08-04 02:12:01.020089	\N
110	dm_velum_477	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.027166	2026-08-04 02:12:01.027166	\N
111	dm_velum_478	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.035381	2026-08-04 02:12:01.035381	\N
112	dm_velum_479	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.046525	2026-08-04 02:12:01.046525	\N
113	dm_velum_480	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.054086	2026-08-04 02:12:01.054086	\N
114	dm_velum_481	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.060642	2026-08-04 02:12:01.060642	\N
115	dm_velum_482	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.067358	2026-08-04 02:12:01.067358	\N
116	dm_velum_483	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.074494	2026-08-04 02:12:01.074494	\N
117	dm_velum_484	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.081528	2026-08-04 02:12:01.081528	\N
118	dm_velum_485	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.088977	2026-08-04 02:12:01.088977	\N
119	dm_velum_486	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.094761	2026-08-04 02:12:01.094761	\N
120	dm_velum_487	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.10421	2026-08-04 02:12:01.10421	\N
121	dm_velum_488	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.113794	2026-08-04 02:12:01.113794	\N
122	dm_velum_489	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.123587	2026-08-04 02:12:01.123587	\N
123	dm_velum_490	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.134271	2026-08-04 02:12:01.134271	\N
124	dm_velum_491	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.144694	2026-08-04 02:12:01.144694	\N
125	dm_velum_492	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.154652	2026-08-04 02:12:01.154652	\N
126	dm_velum_493	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.161736	2026-08-04 02:12:01.161736	\N
127	dm_velum_494	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.172617	2026-08-04 02:12:01.172617	\N
128	dm_velum_495	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.182506	2026-08-04 02:12:01.182506	\N
129	dm_velum_496	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.191061	2026-08-04 02:12:01.191061	\N
130	dm_velum_497	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.199152	2026-08-04 02:12:01.199152	\N
131	dm_velum_498	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.207817	2026-08-04 02:12:01.207817	\N
132	dm_velum_598	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.215688	2026-08-04 02:12:01.215688	\N
133	dm_velum_600	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.223888	2026-08-04 02:12:01.223888	\N
134	dm_velum_601	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.233547	2026-08-04 02:12:01.233547	\N
135	dm_velum_602	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.243898	2026-08-04 02:12:01.243898	\N
136	dm_velum_603	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.256574	2026-08-04 02:12:01.256574	\N
137	dm_velum_999	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.271452	2026-08-04 02:12:01.271452	\N
138	dm_velum_605	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.284639	2026-08-04 02:12:01.284639	\N
139	dm_velum_606	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.296803	2026-08-04 02:12:01.296803	\N
140	dm_velum_607	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.308256	2026-08-04 02:12:01.308256	\N
141	dm_velum_608	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.321096	2026-08-04 02:12:01.321096	\N
142	dm_velum_609	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.33467	2026-08-04 02:12:01.33467	\N
143	dm_velum_610	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.351183	2026-08-04 02:12:01.351183	\N
144	dm_velum_611	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.364513	2026-08-04 02:12:01.364513	\N
145	dm_velum_612	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.376528	2026-08-04 02:12:01.376528	\N
146	dm_velum_613	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.392061	2026-08-04 02:12:01.392061	\N
147	dm_velum_614	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.403598	2026-08-04 02:12:01.403598	\N
148	dm_velum_615	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.415158	2026-08-04 02:12:01.415158	\N
149	dm_velum_616	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.427826	2026-08-04 02:12:01.427826	\N
150	dm_velum_1	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 02:12:01.450575	2026-08-04 02:12:01.450575	\N
151	lounge_1785800647438	Taipei	Hello	599	\N	f	f	t	f	VL/M-FQ26	ALL	user_created	\N	2026-08-04 02:44:07.446022	2026-08-04 02:44:07.446022	\N
152	sublounge_1785801254653	Yooh	\N	599	151	f	f	t	f	VL/S-WWC2	ALL	user_created	\N	2026-08-04 02:54:14.67494	2026-08-04 02:54:14.67494	\N
153	sublounge_1785801278171	Yes	\N	599	151	f	f	f	f	\N	ALL	user_created	\N	2026-08-04 02:54:38.173246	2026-08-04 02:54:38.173246	\N
154	dm_617_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 04:20:20.753873	2026-08-04 04:20:20.753873	\N
155	dm_599_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 04:20:37.740806	2026-08-04 04:20:37.740806	\N
156	dm_604_617	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 04:20:45.634142	2026-08-04 04:20:45.634142	\N
157	dm_604_618	Direct Message	\N	\N	\N	f	f	t	f	\N	ALL	dm	\N	2026-08-04 04:21:03.305133	2026-08-04 04:21:03.305133	\N
158	sublounge_1785819913029	Yes	\N	599	41	f	f	t	f	VL/S-ILVZ	ALL	user_created	\N	2026-08-04 08:05:13.032272	2026-08-04 08:05:13.032272	\N
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.messages (id, lounge_id, sender_id, content, encrypted, created_at, delivered_to, read_by) FROM stdin;
1	2	604	HiApLA==	t	2026-07-30 00:18:33.604018		
2	12	1	AQAAFgISABIECRM6	t	2026-07-30 00:21:05.893136		
3	13	1	HiQgIDgqMA==	t	2026-07-30 00:26:23.603355		
4	12	1	FDwpMCg6	t	2026-07-30 00:26:57.253841		
5	2	1	HiA1	t	2026-07-30 00:27:28.025933		
6	3	2	Hi0=	t	2026-07-30 00:29:30.245218		
7	4	2	Hi0mPw==	t	2026-07-30 00:29:37.085018		
8	5	2	Hi0mPw==	t	2026-07-30 00:29:43.122391		
9	7	2	Hi8kPg==	t	2026-07-30 00:29:49.738761		
10	8	2	HC8nPg==	t	2026-07-30 00:29:56.162133		
11	9	2	HC8mPg==	t	2026-07-30 00:29:59.870015		
12	12	2	Hi0kPw==	t	2026-07-30 00:30:09.998567		
13	10	599	GCsiOw==	t	2026-07-30 00:30:38.691578		
14	10	599	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	t	2026-07-30 00:30:56.925145		
15	2	599	Hi0k	t	2026-07-30 04:14:40.944018		
16	2	599	GCsiOw==	t	2026-07-30 04:14:48.846675		
17	2	599	Fy0=	t	2026-07-30 15:01:44.648181		
18	2	599	DRMjPC46ZXwqMTpWRQgAHz4TDAELSFUfdjA+OXdwMEIpKj4SFkMYCDsOBENQS1hBZ3J0YHludwt0cGdBU0ICCD0XOA==	t	2026-07-30 15:01:55.899795		
19	10	599	DQQ4ISw8LV8gKytMRT8WHzoAGBYGGwcJd3xne29yAHwabk5XVUFUADIeBBoHMiY1Yj89OGVBLD86TFJdQE0UJ1YRFwQWbCwhNCo6alg1IDhWEB4ZV3AQBgkBFRclaiEwKTYkH3B8ZltUW01Ya1RAVllMRWV8Yj89OBgSHCAs	t	2026-07-30 15:59:38.68651		
20	2	2	DRMjPC46ZXwqMTpWRQgAHz4TDAELSFUfdjA+OXdwMEIpKj4SFkMYCDsOBENXX1BbbnB4ZHtodQp2cGhYEgkXAAI=	t	2026-07-30 16:05:08.383749		
21	2	1	DQQ4ISw8LV8gKytMRT8WHzoCCx0NHRUzZHV+Y31odwcadWdFUl9MMggPBBoWMxEcFDA/PCM6NkFrLy8RRR8cFzpdUV9SUioudjE1JShlLF8kIjpZDxwQCn8SFwJfXRQcOiotMT5wKFchLD5bVEFEWmdSUV9dQVFZZHx7eycvIm9lFjoOHEwUCzQ=	t	2026-07-30 16:31:45.347181		
24	2	599	HiQkNG0mIEE2Ng==	t	2026-07-30 21:39:07.038054		
29	2	604	HiApMCg6PA==	t	2026-07-30 22:46:07.835311		
49	2	604	DyojOi8=	t	2026-07-31 00:31:57.608683		
23	36	599	HiApMDR/KFMxIA==	t	2026-07-30 20:32:37.634081		604
26	36	599	BTElOSF/KV0qLixEGTdQGUo+W1UUIipsOCg=	t	2026-07-30 22:08:05.066709		604
30	36	599	HiApMDQmPEs=	t	2026-07-30 23:00:33.597565		604
32	36	599	GCo8	t	2026-07-30 23:00:56.974813		604
34	36	599	HzFsew==	t	2026-07-30 23:01:33.812854		604
28	36	599	DyA/	t	2026-07-30 22:45:14.585421		604
36	36	599	HiApMDQ=	t	2026-07-30 23:09:05.653734		604
52	36	599	AS0tIQ==	t	2026-07-31 00:48:33.439572		604
43	36	599	AS0tIT4eNUI=	t	2026-07-30 23:23:26.999729		604
47	36	599	HiApMDQ=	t	2026-07-30 23:29:02.512374		604
46	36	599	HiA1LDQ=	t	2026-07-30 23:28:29.941332		604
39	36	599	FDc5PQ==	t	2026-07-30 23:11:21.267313		604
38	36	599	GCsi	t	2026-07-30 23:09:33.053781		604
41	36	599	FCo1dS8mIA==	t	2026-07-30 23:11:33.094584		604
22	36	604	HiApMCgmZVAwITsd	t	2026-07-30 20:32:19.930527		599
27	36	604	HiApMDQ=	t	2026-07-30 22:45:04.374798		599
25	36	604	HiApMDQ=	t	2026-07-30 22:07:50.955649		599
33	36	604	AS0tIW0xKkU=	t	2026-07-30 23:01:24.428751		599
31	36	604	DyA/Jj4=	t	2026-07-30 23:00:45.335459		599
35	36	604	GCo8	t	2026-07-30 23:01:47.821213		599
37	36	604	Hi0kPQ==	t	2026-07-30 23:09:26.777024		599
40	36	604	AS0tIQ==	t	2026-07-30 23:11:26.441459		599
42	36	604	HiA1	t	2026-07-30 23:23:05.005173		599
44	36	604	FDcj	t	2026-07-30 23:23:43.193033		599
45	36	604	DyojOi8=	t	2026-07-30 23:28:21.298132		599
50	36	604	HiwlPCQ=	t	2026-07-31 00:37:40.833806		599
51	36	604	HiA1LG0yJFw=	t	2026-07-31 00:48:06.868769		599
53	36	604	HiApMDQ=	t	2026-07-31 01:26:20.400696		599
48	36	604	HiApMDQ=	t	2026-07-31 00:31:24.319203		599
54	36	604	DyojOiV/J0AwLQ==	t	2026-07-31 01:29:33.975195		
55	36	599	AS0t	t	2026-07-31 01:30:39.995252	604	
56	36	604	DyA2	t	2026-07-31 01:30:51.878058	599	
57	36	604	Aio8	t	2026-07-31 01:31:02.545646	599	
58	36	599	FDwp	t	2026-07-31 01:31:09.054311	604	
59	2	1	DyojOiU=	t	2026-07-31 10:09:41.322686		
60	38	999	Welcome to Velum. Your recovery key is: VEL-REC-87963. Store this securely. You will not receive it again.	f	2026-08-03 23:36:11.082996		
61	36	604	DyojOiU=	t	2026-08-03 23:39:23.04607		
62	36	599	AS0tIT4qNQ==	t	2026-08-03 23:40:04.552337	604	
63	36	604	GyAk	t	2026-08-03 23:40:14.023365	599	
64	12	2	HiApMCg6PEs8PCY=	t	2026-08-04 01:36:02.818264		
65	40	599	DyojOiV/J0AwLQ==	t	2026-08-04 01:43:16.766513		
66	12	1	FDw1LCg6Nw==	t	2026-08-04 02:12:00.145193		
67	42	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.20639		
68	43	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.223878		
69	44	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.259454		
70	45	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.292354		
71	46	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.331151		
72	47	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.399769		
73	48	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.420772		
74	49	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.431089		
75	50	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.440196		
76	51	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.450568		
77	52	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.459894		
78	53	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.469461		
79	54	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.479329		
80	55	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.489261		
81	56	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.498416		
82	57	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.508108		
83	58	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.518063		
84	59	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.527403		
85	60	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.537249		
86	61	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.54679		
87	62	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.562245		
88	63	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.573457		
89	64	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.583292		
90	65	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.590495		
91	66	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.598208		
92	67	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.607913		
93	68	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.617885		
94	69	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.627837		
95	70	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.635486		
96	71	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.64499		
97	72	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.65553		
98	73	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.665914		
99	74	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.676757		
100	75	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.684368		
101	76	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.694172		
102	77	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.704476		
103	78	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.714269		
104	79	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.724603		
105	80	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.736984		
106	81	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.74709		
107	82	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.757284		
108	83	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.764794		
109	84	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.775276		
110	85	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.786225		
111	86	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.795532		
112	87	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.806055		
113	88	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.816103		
114	89	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.825466		
115	90	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.836112		
116	91	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.846525		
117	92	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.856545		
118	93	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.866406		
119	94	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.87642		
120	95	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.886954		
121	96	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.896728		
122	97	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.905946		
123	98	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.917353		
124	99	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.927474		
125	100	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.938436		
126	101	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.948178		
127	102	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.957229		
128	103	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.967935		
129	104	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.977794		
130	105	999	FDw1LCg6Nw==	f	2026-08-04 02:12:00.988167		
131	106	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.000612		
132	107	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.007241		
133	108	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.015232		
134	109	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.022389		
135	110	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.029259		
136	111	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.038654		
137	112	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.049569		
138	113	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.056186		
139	114	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.062969		
140	115	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.069706		
141	116	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.077182		
142	117	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.083773		
143	118	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.090941		
144	119	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.098234		
145	120	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.107621		
146	121	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.117284		
147	122	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.126919		
148	123	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.137626		
149	124	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.148431		
150	125	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.157221		
151	126	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.164219		
152	127	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.176573		
153	128	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.185809		
154	129	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.193781		
155	130	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.202772		
156	131	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.210619		
157	132	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.218317		
158	133	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.227484		
159	134	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.237348		
160	135	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.247883		
161	136	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.261505		
162	137	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.275939		
163	138	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.288923		
164	139	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.300897		
165	140	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.31228		
166	141	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.32562		
167	142	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.340239		
168	143	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.35524		
169	144	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.369563		
170	145	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.380356		
171	37	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.385853		
172	146	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.396228		
173	147	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.407128		
174	148	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.419581		
175	149	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.432653		
176	38	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.440906		
177	150	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.455497		
178	35	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.464724		
179	39	999	FDw1LCg6Nw==	f	2026-08-04 02:12:01.472297		
180	12	1	GCQhMG0zIEY2ZTkDCQAMTTkUAA0bHAENBAE=	t	2026-08-04 02:21:15.690744		
181	12	1	eGti	t	2026-08-04 02:21:34.278675		
182	12	1	Aiw8	t	2026-08-04 02:22:57.662518		
183	12	1	Hi0kPSU3	t	2026-08-04 02:48:00.152569		
184	12	1	Hi0kPSg6IFc8PCYP	t	2026-08-04 02:50:45.416441		
185	152	599	Hi0kMDQm	t	2026-08-04 02:54:30.007511		
186	12	1	Hi0kMCgmPEs=	t	2026-08-04 02:55:05.420304		
187	42	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.445107		
188	43	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.454512		
189	44	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.461864		
190	45	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.469479		
191	46	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.478971		
192	47	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.493213		
193	48	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.505948		
194	49	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.518275		
195	50	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.53129		
196	51	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.539108		
197	52	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.546845		
198	53	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.554789		
199	54	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.562131		
200	55	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.567078		
201	56	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.572256		
202	57	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.577704		
203	58	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.583116		
204	59	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.588694		
205	60	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.593571		
206	61	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.598354		
207	62	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.603958		
208	63	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.609558		
209	64	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.614774		
210	65	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.621722		
211	66	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.628062		
212	67	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.633737		
213	68	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.640941		
214	69	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.646045		
215	70	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.65106		
216	71	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.656321		
217	72	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.662016		
218	73	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.667401		
219	74	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.67303		
220	75	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.678572		
221	76	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.683648		
222	77	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.688712		
223	78	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.694095		
224	79	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.699283		
225	80	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.705328		
226	81	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.710747		
227	82	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.715856		
228	83	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.721906		
229	84	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.727477		
230	85	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.732812		
231	86	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.738351		
232	87	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.74398		
233	88	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.749305		
234	89	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.755145		
235	90	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.760536		
236	91	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.765695		
237	92	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.771747		
238	93	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.776806		
239	94	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.781221		
240	95	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.786301		
241	96	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.791268		
242	97	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.796271		
243	98	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.801381		
244	99	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.806699		
245	100	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.811887		
246	101	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.816555		
247	102	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.822567		
248	103	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.830077		
249	104	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.836356		
250	105	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.840582		
251	106	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.846258		
252	107	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.850029		
253	108	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.85428		
254	109	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.858263		
255	110	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.861987		
256	111	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.866484		
257	112	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.871331		
258	113	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.876322		
259	114	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.881171		
260	115	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.885892		
261	116	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.891313		
262	117	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.896307		
263	118	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.901989		
264	119	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.907062		
265	120	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.912574		
266	121	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.919257		
267	122	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.924588		
268	123	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.929915		
269	124	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.935489		
270	125	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.939059		
271	126	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.94376		
272	127	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.948425		
273	128	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.953658		
274	129	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.959		
275	130	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.964695		
276	131	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.970765		
277	132	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.978254		
278	133	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.983078		
279	134	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.98828		
280	135	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:05.993469		
281	136	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.002148		
282	137	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.007629		
283	138	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.013152		
284	139	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.019106		
285	140	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.025291		
286	141	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.02978		
287	142	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.034604		
288	143	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.039579		
289	144	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.044788		
290	145	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.049965		
291	37	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.055802		
292	146	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.059879		
293	147	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.065596		
294	148	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.069447		
295	149	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.074803		
296	38	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.079514		
297	35	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.084449		
298	150	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.089141		
299	39	999	Hi0kMCgmPEs=	f	2026-08-04 02:55:06.094432		
300	12	1	Hi0pMCgmPEs8	t	2026-08-04 03:00:29.300138		
301	12	1	HiA1LG3wqKmK	t	2026-08-04 03:05:26.542016		
302	12	1	FCo1dS8mIBLwroCO	t	2026-08-04 03:08:46.014594		
303	42	999	Boy bye 👋	f	2026-08-04 03:08:46.0675		
304	43	999	Boy bye 👋	f	2026-08-04 03:08:46.090607		
305	44	999	Boy bye 👋	f	2026-08-04 03:08:46.108094		
306	45	999	Boy bye 👋	f	2026-08-04 03:08:46.114693		
307	46	999	Boy bye 👋	f	2026-08-04 03:08:46.124971		
308	47	999	Boy bye 👋	f	2026-08-04 03:08:46.132424		
309	48	999	Boy bye 👋	f	2026-08-04 03:08:46.140635		
310	49	999	Boy bye 👋	f	2026-08-04 03:08:46.147607		
311	50	999	Boy bye 👋	f	2026-08-04 03:08:46.160721		
312	51	999	Boy bye 👋	f	2026-08-04 03:08:46.167019		
313	52	999	Boy bye 👋	f	2026-08-04 03:08:46.174306		
314	53	999	Boy bye 👋	f	2026-08-04 03:08:46.17936		
315	54	999	Boy bye 👋	f	2026-08-04 03:08:46.184552		
316	55	999	Boy bye 👋	f	2026-08-04 03:08:46.189852		
317	56	999	Boy bye 👋	f	2026-08-04 03:08:46.195776		
318	57	999	Boy bye 👋	f	2026-08-04 03:08:46.201516		
319	58	999	Boy bye 👋	f	2026-08-04 03:08:46.20795		
320	59	999	Boy bye 👋	f	2026-08-04 03:08:46.214382		
321	60	999	Boy bye 👋	f	2026-08-04 03:08:46.219874		
322	61	999	Boy bye 👋	f	2026-08-04 03:08:46.225226		
323	62	999	Boy bye 👋	f	2026-08-04 03:08:46.230466		
324	63	999	Boy bye 👋	f	2026-08-04 03:08:46.235826		
325	64	999	Boy bye 👋	f	2026-08-04 03:08:46.241831		
326	65	999	Boy bye 👋	f	2026-08-04 03:08:46.247163		
327	66	999	Boy bye 👋	f	2026-08-04 03:08:46.252869		
328	67	999	Boy bye 👋	f	2026-08-04 03:08:46.258432		
329	68	999	Boy bye 👋	f	2026-08-04 03:08:46.263502		
330	69	999	Boy bye 👋	f	2026-08-04 03:08:46.269235		
331	70	999	Boy bye 👋	f	2026-08-04 03:08:46.274928		
332	71	999	Boy bye 👋	f	2026-08-04 03:08:46.280469		
333	72	999	Boy bye 👋	f	2026-08-04 03:08:46.285836		
334	73	999	Boy bye 👋	f	2026-08-04 03:08:46.29147		
335	74	999	Boy bye 👋	f	2026-08-04 03:08:46.296644		
336	75	999	Boy bye 👋	f	2026-08-04 03:08:46.301898		
337	76	999	Boy bye 👋	f	2026-08-04 03:08:46.307048		
338	77	999	Boy bye 👋	f	2026-08-04 03:08:46.311922		
339	78	999	Boy bye 👋	f	2026-08-04 03:08:46.317483		
340	79	999	Boy bye 👋	f	2026-08-04 03:08:46.324033		
341	80	999	Boy bye 👋	f	2026-08-04 03:08:46.329913		
342	81	999	Boy bye 👋	f	2026-08-04 03:08:46.33539		
343	82	999	Boy bye 👋	f	2026-08-04 03:08:46.340718		
344	83	999	Boy bye 👋	f	2026-08-04 03:08:46.345979		
345	84	999	Boy bye 👋	f	2026-08-04 03:08:46.351075		
346	85	999	Boy bye 👋	f	2026-08-04 03:08:46.356091		
347	86	999	Boy bye 👋	f	2026-08-04 03:08:46.361235		
348	87	999	Boy bye 👋	f	2026-08-04 03:08:46.366175		
349	88	999	Boy bye 👋	f	2026-08-04 03:08:46.371879		
350	89	999	Boy bye 👋	f	2026-08-04 03:08:46.377392		
351	90	999	Boy bye 👋	f	2026-08-04 03:08:46.382108		
352	91	999	Boy bye 👋	f	2026-08-04 03:08:46.387653		
353	92	999	Boy bye 👋	f	2026-08-04 03:08:46.392561		
354	93	999	Boy bye 👋	f	2026-08-04 03:08:46.397488		
355	94	999	Boy bye 👋	f	2026-08-04 03:08:46.402813		
356	95	999	Boy bye 👋	f	2026-08-04 03:08:46.411131		
357	96	999	Boy bye 👋	f	2026-08-04 03:08:46.415713		
358	97	999	Boy bye 👋	f	2026-08-04 03:08:46.420119		
359	98	999	Boy bye 👋	f	2026-08-04 03:08:46.425384		
360	99	999	Boy bye 👋	f	2026-08-04 03:08:46.431398		
361	100	999	Boy bye 👋	f	2026-08-04 03:08:46.436264		
362	101	999	Boy bye 👋	f	2026-08-04 03:08:46.441258		
363	102	999	Boy bye 👋	f	2026-08-04 03:08:46.445171		
364	103	999	Boy bye 👋	f	2026-08-04 03:08:46.45034		
365	104	999	Boy bye 👋	f	2026-08-04 03:08:46.456074		
366	105	999	Boy bye 👋	f	2026-08-04 03:08:46.46088		
367	106	999	Boy bye 👋	f	2026-08-04 03:08:46.464931		
368	107	999	Boy bye 👋	f	2026-08-04 03:08:46.468693		
369	108	999	Boy bye 👋	f	2026-08-04 03:08:46.472808		
370	109	999	Boy bye 👋	f	2026-08-04 03:08:46.477737		
371	110	999	Boy bye 👋	f	2026-08-04 03:08:46.482415		
372	111	999	Boy bye 👋	f	2026-08-04 03:08:46.48699		
373	112	999	Boy bye 👋	f	2026-08-04 03:08:46.491915		
374	113	999	Boy bye 👋	f	2026-08-04 03:08:46.497103		
375	114	999	Boy bye 👋	f	2026-08-04 03:08:46.503657		
376	115	999	Boy bye 👋	f	2026-08-04 03:08:46.508731		
377	116	999	Boy bye 👋	f	2026-08-04 03:08:46.515356		
378	117	999	Boy bye 👋	f	2026-08-04 03:08:46.520774		
379	118	999	Boy bye 👋	f	2026-08-04 03:08:46.525497		
380	119	999	Boy bye 👋	f	2026-08-04 03:08:46.53052		
381	120	999	Boy bye 👋	f	2026-08-04 03:08:46.535644		
382	121	999	Boy bye 👋	f	2026-08-04 03:08:46.540958		
383	122	999	Boy bye 👋	f	2026-08-04 03:08:46.553122		
384	123	999	Boy bye 👋	f	2026-08-04 03:08:46.569592		
385	124	999	Boy bye 👋	f	2026-08-04 03:08:46.581281		
386	125	999	Boy bye 👋	f	2026-08-04 03:08:46.592854		
387	126	999	Boy bye 👋	f	2026-08-04 03:08:46.604737		
388	127	999	Boy bye 👋	f	2026-08-04 03:08:46.615442		
389	128	999	Boy bye 👋	f	2026-08-04 03:08:46.626951		
390	129	999	Boy bye 👋	f	2026-08-04 03:08:46.640262		
391	130	999	Boy bye 👋	f	2026-08-04 03:08:46.702417		
392	131	999	Boy bye 👋	f	2026-08-04 03:08:46.709539		
393	132	999	Boy bye 👋	f	2026-08-04 03:08:46.714643		
394	133	999	Boy bye 👋	f	2026-08-04 03:08:46.719402		
395	134	999	Boy bye 👋	f	2026-08-04 03:08:46.723952		
396	135	999	Boy bye 👋	f	2026-08-04 03:08:46.728504		
397	136	999	Boy bye 👋	f	2026-08-04 03:08:46.733359		
398	137	999	Boy bye 👋	f	2026-08-04 03:08:46.739133		
399	138	999	Boy bye 👋	f	2026-08-04 03:08:46.743728		
400	139	999	Boy bye 👋	f	2026-08-04 03:08:46.748965		
401	140	999	Boy bye 👋	f	2026-08-04 03:08:46.75365		
402	141	999	Boy bye 👋	f	2026-08-04 03:08:46.758568		
403	142	999	Boy bye 👋	f	2026-08-04 03:08:46.76367		
404	143	999	Boy bye 👋	f	2026-08-04 03:08:46.768791		
405	144	999	Boy bye 👋	f	2026-08-04 03:08:46.773498		
406	145	999	Boy bye 👋	f	2026-08-04 03:08:46.77886		
407	37	999	Boy bye 👋	f	2026-08-04 03:08:46.784203		
408	146	999	Boy bye 👋	f	2026-08-04 03:08:46.790381		
409	147	999	Boy bye 👋	f	2026-08-04 03:08:46.797776		
410	148	999	Boy bye 👋	f	2026-08-04 03:08:46.803423		
411	149	999	Boy bye 👋	f	2026-08-04 03:08:46.8082		
412	38	999	Boy bye 👋	f	2026-08-04 03:08:46.812668		
413	150	999	Boy bye 👋	f	2026-08-04 03:08:46.817521		
414	35	999	Boy bye 👋	f	2026-08-04 03:08:46.822887		
415	39	999	Boy bye 👋	f	2026-08-04 03:08:46.827996		
416	154	617	HiA1	t	2026-08-04 04:20:29.568842		
417	155	617	HiA1LDQ=	t	2026-08-04 04:20:41.814989		
418	156	617	HiApLDQ=	t	2026-08-04 04:20:49.181973		
419	12	2	eGti	t	2026-08-04 04:21:45.436202		
420	42	999	...	f	2026-08-04 04:21:45.470594		
421	43	999	...	f	2026-08-04 04:21:45.481603		
422	44	999	...	f	2026-08-04 04:21:45.488419		
423	45	999	...	f	2026-08-04 04:21:45.494311		
424	46	999	...	f	2026-08-04 04:21:45.499951		
425	47	999	...	f	2026-08-04 04:21:45.504952		
426	48	999	...	f	2026-08-04 04:21:45.511367		
427	49	999	...	f	2026-08-04 04:21:45.516915		
428	50	999	...	f	2026-08-04 04:21:45.523935		
429	51	999	...	f	2026-08-04 04:21:45.530203		
430	52	999	...	f	2026-08-04 04:21:45.535838		
431	53	999	...	f	2026-08-04 04:21:45.541368		
432	54	999	...	f	2026-08-04 04:21:45.547261		
433	55	999	...	f	2026-08-04 04:21:45.552845		
434	56	999	...	f	2026-08-04 04:21:45.55913		
435	57	999	...	f	2026-08-04 04:21:45.564837		
436	58	999	...	f	2026-08-04 04:21:45.570913		
437	59	999	...	f	2026-08-04 04:21:45.577232		
438	60	999	...	f	2026-08-04 04:21:45.58358		
439	61	999	...	f	2026-08-04 04:21:45.589265		
440	62	999	...	f	2026-08-04 04:21:45.59694		
441	63	999	...	f	2026-08-04 04:21:45.601956		
442	64	999	...	f	2026-08-04 04:21:45.607435		
443	65	999	...	f	2026-08-04 04:21:45.613867		
444	66	999	...	f	2026-08-04 04:21:45.620051		
445	67	999	...	f	2026-08-04 04:21:45.626189		
446	68	999	...	f	2026-08-04 04:21:45.631836		
447	69	999	...	f	2026-08-04 04:21:45.637104		
448	70	999	...	f	2026-08-04 04:21:45.642952		
449	71	999	...	f	2026-08-04 04:21:45.648837		
450	72	999	...	f	2026-08-04 04:21:45.654384		
451	73	999	...	f	2026-08-04 04:21:45.660459		
452	74	999	...	f	2026-08-04 04:21:45.666184		
453	75	999	...	f	2026-08-04 04:21:45.672358		
454	76	999	...	f	2026-08-04 04:21:45.678254		
455	77	999	...	f	2026-08-04 04:21:45.68407		
456	78	999	...	f	2026-08-04 04:21:45.692151		
457	79	999	...	f	2026-08-04 04:21:45.698905		
458	80	999	...	f	2026-08-04 04:21:45.705399		
459	81	999	...	f	2026-08-04 04:21:45.711886		
460	82	999	...	f	2026-08-04 04:21:45.717971		
461	83	999	...	f	2026-08-04 04:21:45.727268		
462	84	999	...	f	2026-08-04 04:21:45.732956		
463	85	999	...	f	2026-08-04 04:21:45.739326		
464	86	999	...	f	2026-08-04 04:21:45.74646		
465	87	999	...	f	2026-08-04 04:21:45.754002		
466	88	999	...	f	2026-08-04 04:21:45.760747		
467	89	999	...	f	2026-08-04 04:21:45.766788		
468	90	999	...	f	2026-08-04 04:21:45.773231		
469	91	999	...	f	2026-08-04 04:21:45.780353		
470	92	999	...	f	2026-08-04 04:21:45.785502		
471	93	999	...	f	2026-08-04 04:21:45.790807		
472	94	999	...	f	2026-08-04 04:21:45.796798		
473	95	999	...	f	2026-08-04 04:21:45.803185		
474	96	999	...	f	2026-08-04 04:21:45.808875		
475	97	999	...	f	2026-08-04 04:21:45.814965		
476	98	999	...	f	2026-08-04 04:21:45.820719		
477	99	999	...	f	2026-08-04 04:21:45.826434		
478	100	999	...	f	2026-08-04 04:21:45.832598		
479	101	999	...	f	2026-08-04 04:21:45.838158		
480	102	999	...	f	2026-08-04 04:21:45.843712		
481	103	999	...	f	2026-08-04 04:21:45.850119		
482	104	999	...	f	2026-08-04 04:21:45.856415		
483	105	999	...	f	2026-08-04 04:21:45.861843		
484	106	999	...	f	2026-08-04 04:21:45.867868		
485	107	999	...	f	2026-08-04 04:21:45.873795		
486	108	999	...	f	2026-08-04 04:21:45.881251		
487	109	999	...	f	2026-08-04 04:21:45.887143		
488	110	999	...	f	2026-08-04 04:21:45.892479		
489	111	999	...	f	2026-08-04 04:21:45.897967		
490	112	999	...	f	2026-08-04 04:21:45.903547		
491	113	999	...	f	2026-08-04 04:21:45.909227		
492	114	999	...	f	2026-08-04 04:21:45.915315		
493	115	999	...	f	2026-08-04 04:21:45.921772		
494	116	999	...	f	2026-08-04 04:21:45.928839		
495	117	999	...	f	2026-08-04 04:21:45.934291		
496	118	999	...	f	2026-08-04 04:21:45.94014		
497	119	999	...	f	2026-08-04 04:21:45.946348		
498	120	999	...	f	2026-08-04 04:21:45.951776		
499	121	999	...	f	2026-08-04 04:21:45.95733		
500	122	999	...	f	2026-08-04 04:21:45.963282		
501	123	999	...	f	2026-08-04 04:21:45.969255		
502	124	999	...	f	2026-08-04 04:21:45.97694		
503	125	999	...	f	2026-08-04 04:21:45.98538		
504	126	999	...	f	2026-08-04 04:21:45.991908		
505	127	999	...	f	2026-08-04 04:21:45.999751		
506	128	999	...	f	2026-08-04 04:21:46.00644		
507	129	999	...	f	2026-08-04 04:21:46.012251		
508	130	999	...	f	2026-08-04 04:21:46.019855		
509	131	999	...	f	2026-08-04 04:21:46.026851		
510	132	999	...	f	2026-08-04 04:21:46.03303		
511	133	999	...	f	2026-08-04 04:21:46.039583		
512	134	999	...	f	2026-08-04 04:21:46.045008		
513	135	999	...	f	2026-08-04 04:21:46.051713		
514	136	999	...	f	2026-08-04 04:21:46.059132		
515	137	999	...	f	2026-08-04 04:21:46.067509		
516	138	999	...	f	2026-08-04 04:21:46.07355		
517	139	999	...	f	2026-08-04 04:21:46.082614		
518	140	999	...	f	2026-08-04 04:21:46.088701		
519	141	999	...	f	2026-08-04 04:21:46.094386		
520	142	999	...	f	2026-08-04 04:21:46.101992		
521	143	999	...	f	2026-08-04 04:21:46.108934		
522	144	999	...	f	2026-08-04 04:21:46.115403		
523	145	999	...	f	2026-08-04 04:21:46.121017		
524	37	999	...	f	2026-08-04 04:21:46.127344		
525	146	999	...	f	2026-08-04 04:21:46.133506		
526	147	999	...	f	2026-08-04 04:21:46.139173		
527	148	999	...	f	2026-08-04 04:21:46.146005		
528	149	999	...	f	2026-08-04 04:21:46.153693		
529	150	999	...	f	2026-08-04 04:21:46.161687		
530	38	999	...	f	2026-08-04 04:21:46.169165		
531	39	999	...	f	2026-08-04 04:21:46.174806		
532	35	999	...	f	2026-08-04 04:21:46.181934		
533	13	2	eGtie2M=	t	2026-08-04 04:21:50.525098		
534	153	604	HiA1LDQ=	t	2026-08-04 04:26:45.75637		
535	152	604	FCo1dS8mIA==	t	2026-08-04 04:26:52.715372		
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
80	311	4b2950d0d4216c8838a25b67b3839cce855af36f57bb89398cdce89828a5088f	127.0.0.1	node	2026-08-05 10:27:13.864	2026-07-29 13:27:13.869739
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
265	614	cbb6c9180174af8af96bb49b3101a30cac00ddda914de768397227ad83abdf59	::ffff:127.0.0.1	\N	2026-08-06 08:00:22.622	2026-07-30 11:00:22.633411
266	615	39db4d3699917ee0d30a4c43557e0ecea34624de63efea66bd0c70550ed0d714	::ffff:127.0.0.1	\N	2026-08-06 08:00:22.665	2026-07-30 11:00:22.67848
267	616	76a7ce2b9c08f85ab6a7cc6082346b18f5a1d75315b8371e55c94df5ca4d1703	::ffff:127.0.0.1	\N	2026-08-06 08:00:23.164	2026-07-30 11:00:23.167604
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
5	DEP-40D6D4E1A092	7	DEPOSIT	1000.00	COMPLETED	Deposit from external	2026-07-29 13:27:17.136983
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
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.users (id, username, password_hash, salt, passcode_hash, panic_phrase_hash, recovery_key_hash, login_recovery_key_hash, duress_active, is_compromised, compromise_ticket_id, role, display_name, avatar_url, bio, created_at, updated_at, location, recovery_key, recovery_key_delivered) FROM stdin;
311	midnight_1_351	a7029d8fd7b8dffa41d2743fae52601d1467189d1b2642ed36fd23c34991570f	14b1165a5a7f729d7624a65beb297583	\N	\N	1aa1c25dfd4a2410d9ce1bd7387ca2e1784d0ac922bdff7e39aac193043052f8	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:13.830864	2026-07-29 13:27:13.830864	\N	\N	f
312	lexie_0_99	492b4fa4c36183209b1292ebcebe4e2995a798c63ab90737b7a991f72268bb60	71679416fc5d9f270a0f32c705c72475	\N	\N	2519afdbbab5bfd4d6b38e2313a246ef348813a240ed0523871403b2d6ee08e5	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:14.253356	2026-07-29 13:27:14.253356	\N	\N	f
313	zen_2_506	c13fa09b0cc2e0c59e4602724e92945fb820ef30314fe241cc511782b8c79c69	f6bd9207f70d72d21b779bd5b138f4f9	\N	\N	ebf8b354a66a12e8960be8fc2e03b593d812095dc11fe4fa2f6c57b9251d8353	\N	f	f	\N	USER	\N	\N	\N	2026-07-29 13:27:14.606891	2026-07-29 13:27:14.606891	\N	\N	f
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
2	lexie	7b03128b8689716ca2ac47b7b26d069b649fc70180f480da920d9cdb74eff4bc	f4e065ecc660b61418fc5d7bd82992d9	\N	\N	\N	\N	f	f	\N	LOGIN_ADMIN	lexie	/uploads/avatar-2-1785416305569.webp	Verified Executive Administrator.	2026-07-29 04:02:14.543938	2026-08-04 05:29:15.753	\N	\N	f
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
614	sender_1785398421819	d1a7fabf8cd11162677287962757c8b8498354b1cd818ac0d2fbfd2e83b624b8	e93c93d551af621fc897c8f29dadbac9	\N	\N	f0af2549744e039a41882ef62a118fc492ce8c45c86de682009fe1ee16124bb4	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 11:00:22.58175	2026-07-30 11:00:22.58175	\N	\N	f
615	seller_1785398421818	ec5df23b07ed0022032be5920dcdb9dd2452a0b13e293138a641673bca6a5de6	8f1d15be00d13c0cf289dab611a99ac2	\N	\N	51b0447efa787681fbb2df01dffaca6a321d8979a1ef965b2ea4cd3ea52aeb12	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 11:00:22.629127	2026-07-30 11:00:22.629127	\N	\N	f
616	recipient_1785398421819	80425dcae50c2d492e4686b4aaaae121c3ab12381e6d722c0b188e5faf975c1a	ebef096c9500368f68c403e9836bf29a	\N	\N	d5176e0f61798887f45e769b4659fef5e6207e909c1805f9f591d1821f67be40	\N	f	f	\N	USER	\N	\N	\N	2026-07-30 11:00:23.159148	2026-07-30 11:00:23.159148	\N	\N	f
599	Iran	1d40c222304fd33aa8cfa4aad78a0e4c32a1b86706bed4e8ad2db6952ddddb18	73131393b88aab868b26caaa46fe7ad6	\N	9aa91449d2c12c639f96fb603d7c6cbc01a696a590de368d17a7c274533833ca	a8b4f1e61d337c7da9b326793fe1cbfd19dc787615be3df87e89bc26d8618181	\N	f	f	\N	USER	Iran	/uploads/avatar-599-1785416332733.webp		2026-07-29 18:36:09.803564	2026-08-04 05:39:12.481	\N	\N	f
604	Tehran	8efcea50a518b7b19f499ee4cc0fd410b39be6630d15d26c1924ed482139e80e	135cef1bd32dbc9730c956c4ba8f290a	\N	e4aff3f2c873e451f9ebf12c59001c7ff940c8694bc2c69d53682d9a95dc8943	897376a41c5d83b080b3a55711f4b1368959e853fac8b69307552bd6c0ebbdec	\N	f	f	\N	USER	Tehran	/uploads/avatar-604-1785416408791.webp		2026-07-29 23:06:49.936224	2026-08-04 05:39:28.852	\N	\N	f
617	Seoul	7dca22cc8e061d289fa9823b4e22d73e1b67a0174ba2f538d67ba232fcb45683	3f5773b863ed462e47d3dceb4d82f155	\N	\N	\N	\N	f	f	\N	BOT	\N	\N	\N	2026-07-30 16:33:53.973673	2026-08-04 05:39:39.856	\N	\N	f
618	Taiwan	a027cc2c4238ecc0c70fdee2e69cc5f78549969adb3f0cf58872fb869bfc30d6	2aa48b82f213c36712bd1a04b0592fc4	\N	f2ea97739e4543f78ce05251bc4447f21be8e6d0364cec9dcc3f98b57b71ecee	361b8e8af2607755334e14cc716bd09a26b34c6370042e09d462ec7b2939a47d	\N	f	f	\N	USER	\N	\N	\N	2026-08-03 23:35:53.151078	2026-08-04 05:39:01.08	\N	VEL-REC-87963	t
1	midnight	6d8390125514b3f36e31378b9d850c02cfb09f77a12c8d3dd222a6bdfa2be079	698eb1bc7d71072103968966a39c3794	\N	\N	\N	\N	f	f	\N	CLI_ADMIN	midnight	/uploads/avatar-1-1785416262917.webp	Verified Executive Administrator.	2026-07-29 04:02:14.380338	2026-08-04 05:29:01.662	\N	\N	f
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: u0_a345
--

COPY public.wallets (id, user_id, balance, currency, created_at, updated_at) FROM stdin;
94	599	75.21	EUR	2026-07-30 03:55:15.57309	2026-07-30 05:51:42.37
95	599	150.00	TWD	2026-07-30 04:03:11.448375	2026-07-30 06:57:34.674
92	599	13.59	VLM	2026-07-30 03:55:15.544652	2026-07-30 06:57:34.689
104	607	0.00	USD	2026-07-30 10:22:33.739556	2026-07-30 10:22:33.739556
106	614	0.00	USD	2026-07-30 11:00:23.231737	2026-07-30 11:00:23.231737
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
7	311	1000.00	USD	2026-07-29 13:27:17.136983	2026-07-29 10:27:17.22
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
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: u0_a345
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 88, true);


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

SELECT pg_catalog.setval('public.listings_id_seq', 13, true);


--
-- Name: lounge_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.lounge_members_id_seq', 5, true);


--
-- Name: lounges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.lounges_id_seq', 158, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.messages_id_seq', 535, true);


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

SELECT pg_catalog.setval('public.sessions_id_seq', 416, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.transactions_id_seq', 93, true);


--
-- Name: user_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.user_devices_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.users_id_seq', 618, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a345
--

SELECT pg_catalog.setval('public.wallets_id_seq', 138, true);


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
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


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
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_messages_lounge_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_lounge_id ON public.messages USING btree (lounge_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: u0_a345
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


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
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: u0_a345
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict oFCnI09HiR6avvfsZIg1hlTjdh0IVsKBKqP37bWAZDdWQTDfqml6hSTpUueBkUh

