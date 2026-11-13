-- Crea las bases propias de reportes y auditoria (EP5, Spec 044): una base y un usuario por servicio, como las demás.
-- Se puede repetir sin efectos. Lo ejecuta rds-crear-bases.sh con el usuario maestro de la RDS; pasa las claves como variables de psql:
--   psql -v rep_pass=... -v aud_pass=... -f rds-crear-bases.sql
--
-- En RDS el usuario maestro no es superusuario: para CREATE DATABASE ... OWNER x tiene que ser miembro de x (GRANT x TO CURRENT_USER).

-- reportes
SELECT format('CREATE ROLE reportes_user LOGIN PASSWORD %L', :'rep_pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reportes_user') \gexec
GRANT reportes_user TO CURRENT_USER;
SELECT 'CREATE DATABASE reportes_db OWNER reportes_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reportes_db') \gexec
-- Aislamiento: nadie más entra a esta base (cada servicio solo ve la suya).
REVOKE ALL ON DATABASE reportes_db FROM PUBLIC;

-- auditoria
SELECT format('CREATE ROLE auditoria_user LOGIN PASSWORD %L', :'aud_pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'auditoria_user') \gexec
GRANT auditoria_user TO CURRENT_USER;
SELECT 'CREATE DATABASE auditoria_db OWNER auditoria_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'auditoria_db') \gexec
REVOKE ALL ON DATABASE auditoria_db FROM PUBLIC;

\echo 'Bases listas: reportes_db y auditoria_db'
