-- AddIndex: GIST spatial index on user_profiles.location for ST_DWithin / ST_Distance performance
CREATE INDEX IF NOT EXISTS "user_profiles_location_gist" ON "user_profiles" USING GIST ("location");
