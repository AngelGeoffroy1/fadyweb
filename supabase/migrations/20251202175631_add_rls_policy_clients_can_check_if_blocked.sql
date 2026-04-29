-- Politique RLS pour permettre aux clients de vérifier s'ils sont bloqués
CREATE POLICY "Clients can check if they are blocked"
ON "public"."blocked_clients"
FOR SELECT
TO public
USING (blocked_user_id = auth.uid());

-- Commentaire pour documenter la table
COMMENT ON POLICY "Clients can check if they are blocked" ON "public"."blocked_clients" 
IS 'Permet aux clients de vérifier s''ils sont bloqués par un coiffeur pour adapter l''interface (désactiver chat et réservation)';;
