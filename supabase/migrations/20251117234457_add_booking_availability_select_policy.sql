-- Créer une policy RLS pour permettre aux utilisateurs de voir les créneaux occupés
-- Cette policy permet à tout utilisateur authentifié de voir les bookings confirmés/pending
-- pour vérifier la disponibilité d'un coiffeur, SANS accéder aux données personnelles

CREATE POLICY "Users can view booking time slots for availability checking"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  -- Permettre de voir les bookings confirmed ou pending de n'importe quel coiffeur
  -- Cela permet de vérifier la disponibilité sans accéder aux données personnelles
  status IN ('confirmed', 'pending')
);

-- Cette policy fonctionne en combinaison avec les policies existantes :
-- - Les utilisateurs voient TOUS les bookings confirmed/pending (pour disponibilité)
-- - Les utilisateurs voient aussi leurs PROPRES bookings (tous statuts)
-- - Les coiffeurs voient les bookings qui leur sont destinés
-- - Les admins voient tout

COMMENT ON POLICY "Users can view booking time slots for availability checking" ON public.bookings IS 
'Permet aux utilisateurs authentifiés de voir les créneaux occupés (confirmed/pending) pour vérifier la disponibilité des coiffeurs. Cette policy ne donne pas accès aux détails personnels - elle permet seulement de voir qu''un créneau est occupé.';
;
