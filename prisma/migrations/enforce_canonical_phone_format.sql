-- Application intake normalizes phone values with libphonenumber-js first.
-- These guards reject non-E.164 storage even when a writer bypasses the app.
-- Historical invalid values may remain unchanged so unrelated updates still work.
-- One atomic statement; safe to reapply. Do not rewrite or merge existing rows.
DO $migration$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  CREATE OR REPLACE FUNCTION public.enforce_canonical_phone_format()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $function$
  DECLARE
    phone_value text;
  BEGIN
    phone_value := to_jsonb(NEW) ->> TG_ARGV[0];
    IF TG_OP = 'UPDATE' THEN
      IF phone_value IS NOT DISTINCT FROM (to_jsonb(OLD) ->> TG_ARGV[0]) THEN
        RETURN NEW;
      END IF;
    END IF;

    IF phone_value IS NULL AND TG_ARGV[1] = 'optional' THEN
      RETURN NEW;
    END IF;
    IF phone_value IS NULL OR phone_value !~ '^[+][1-9][0-9]{1,14}$' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'Phone must use canonical international E.164 format (+country code and national digits)',
        CONSTRAINT = 'canonical_phone_format',
        COLUMN = TG_ARGV[0],
        TABLE = TG_TABLE_NAME;
    END IF;
    RETURN NEW;
  END;
  $function$;

  DROP TRIGGER IF EXISTS contacts_canonical_phone_format ON public.contacts;
  CREATE TRIGGER contacts_canonical_phone_format
    BEFORE INSERT OR UPDATE OF phone ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.enforce_canonical_phone_format('phone', 'required');

  DROP TRIGGER IF EXISTS sender_canonical_phone_format ON public.phone_numbers;
  CREATE TRIGGER sender_canonical_phone_format
    BEFORE INSERT OR UPDATE OF "phoneNumber" ON public.phone_numbers
    FOR EACH ROW EXECUTE FUNCTION public.enforce_canonical_phone_format('phoneNumber', 'required');

  DROP TRIGGER IF EXISTS user_canonical_phone_format ON public.users;
  CREATE TRIGGER user_canonical_phone_format
    BEFORE INSERT OR UPDATE OF "telnyxPhoneNumber" ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.enforce_canonical_phone_format('telnyxPhoneNumber', 'optional');
END;
$migration$;
