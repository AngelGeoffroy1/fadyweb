-- Toggle d'affichage du numéro pro côté UI : la colonne show_phone
-- est ajoutée à hairdressers et la décision d'afficher ou non phone se fait
-- côté client (iOS / Web). Aucune vue ni RPC n'est nécessaire.

ALTER TABLE public.hairdressers
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hairdressers.show_phone IS
  'Opt-in du coiffeur pour afficher son numéro pro sur les surfaces publiques (gating UI uniquement).';

NOTIFY pgrst, 'reload schema';
