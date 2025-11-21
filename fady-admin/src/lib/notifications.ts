/**
 * Fonctions utilitaires pour envoyer des notifications push
 * via les edge functions Supabase
 */

import { createClient } from '@/lib/supabase/browser'

interface NotificationData {
  type?: 'booking' | 'ticket' | 'refund' | 'diploma' | 'general';
  bookingId?: string;
  ticketId?: string;
  diplomaId?: string;
  action?: string;
  [key: string]: any;
}

interface SendNotificationParams {
  userId: string;
  title: string;
  body: string;
  data?: NotificationData;
  badge?: number;
}

interface NotificationResponse {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
}

/**
 * Envoie une notification push à un client (Fady App)
 */
export async function sendClientNotification(
  params: SendNotificationParams
): Promise<NotificationResponse> {
  try {
    // Récupérer le token de session de l'admin connecté
    const supabase = createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      throw new Error('Session expirée, veuillez vous reconnecter')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erreur lors de l\'envoi de la notification client:', error);
      throw new Error(error.error || 'Échec de l\'envoi de la notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification client:', error);
    throw error;
  }
}

/**
 * Envoie une notification push à un coiffeur (Fady Pro)
 */
export async function sendHairdresserNotification(
  params: SendNotificationParams
): Promise<NotificationResponse> {
  try {
    // Récupérer le token de session de l'admin connecté
    const supabase = createClient()
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
      throw new Error('Session expirée, veuillez vous reconnecter')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push-notification-fady-pro`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Erreur lors de l\'envoi de la notification coiffeur:', error);
      throw new Error(error.error || 'Échec de l\'envoi de la notification');
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification coiffeur:', error);
    throw error;
  }
}

/**
 * Notifications prédéfinies pour les différentes actions admin
 */
export const NotificationTemplates = {
  // Notifications diplômes
  diplomaApproved: (hairdresserId: string) => ({
    userId: hairdresserId,
    title: 'Diplôme vérifié ✓',
    body: 'Félicitations ! Votre diplôme a été vérifié. Vous êtes maintenant un coiffeur diplômé.',
    data: {
      type: 'diploma' as const,
      action: 'approved',
    },
  }),

  diplomaRejected: (hairdresserId: string, reason?: string) => ({
    userId: hairdresserId,
    title: 'Diplôme refusé',
    body: reason || 'Votre diplôme n\'a pas pu être vérifié. Veuillez vérifier vos documents.',
    data: {
      type: 'diploma' as const,
      action: 'rejected',
    },
  }),

  // Notifications réservations - Client
  bookingConfirmedClient: (userId: string, bookingId: string, hairdresserName: string, date: string) => ({
    userId,
    title: 'Réservation confirmée',
    body: `Votre réservation du ${date} est confirmée avec ${hairdresserName}`,
    data: {
      type: 'booking' as const,
      bookingId,
      action: 'confirmed',
    },
  }),

  bookingCancelledClient: (userId: string, bookingId: string, hairdresserName: string, date: string) => ({
    userId,
    title: 'Réservation annulée',
    body: `Votre réservation du ${date} avec ${hairdresserName} a été annulée`,
    data: {
      type: 'booking' as const,
      bookingId,
      action: 'cancelled',
    },
  }),

  bookingCompletedClient: (userId: string, bookingId: string, hairdresserName: string) => ({
    userId,
    title: 'Prestation terminée',
    body: `Votre prestation avec ${hairdresserName} est terminée. Laissez un avis !`,
    data: {
      type: 'booking' as const,
      bookingId,
      action: 'completed',
    },
  }),

  // Notifications réservations - Coiffeur
  bookingConfirmedHairdresser: (hairdresserId: string, bookingId: string, clientName: string, date: string) => ({
    userId: hairdresserId,
    title: 'Nouvelle réservation confirmée',
    body: `Réservation confirmée le ${date} avec ${clientName}`,
    data: {
      type: 'booking' as const,
      bookingId,
      action: 'confirmed',
    },
  }),

  bookingCancelledHairdresser: (hairdresserId: string, bookingId: string, clientName: string, date: string) => ({
    userId: hairdresserId,
    title: 'Réservation annulée',
    body: `La réservation du ${date} avec ${clientName} a été annulée`,
    data: {
      type: 'booking' as const,
      bookingId,
      action: 'cancelled',
    },
  }),

  bookingCompletedHairdresser: (hairdresserId: string, bookingId: string, clientName: string, date: string) => ({
    userId: hairdresserId,
    title: 'Prestation marquée comme terminée',
    body: `La prestation du ${date} avec ${clientName} est terminée`,
    data: {
      type: 'booking' as const,
      bookingId,
      action: 'completed',
    },
  }),

  // Notifications support
  ticketInProgress: (userId: string, ticketId: string) => ({
    userId,
    title: 'Ticket en cours de traitement',
    body: 'Votre demande de support est en cours de traitement',
    data: {
      type: 'ticket' as const,
      ticketId,
      action: 'in_progress',
    },
  }),

  ticketResolved: (userId: string, ticketId: string) => ({
    userId,
    title: 'Ticket résolu',
    body: 'Votre demande de support a été résolue',
    data: {
      type: 'ticket' as const,
      ticketId,
      action: 'resolved',
    },
  }),

  ticketClosed: (userId: string, ticketId: string) => ({
    userId,
    title: 'Ticket fermé',
    body: 'Votre demande de support a été fermée',
    data: {
      type: 'ticket' as const,
      ticketId,
      action: 'closed',
    },
  }),

  adminResponse: (userId: string, ticketId: string) => ({
    userId,
    title: 'Réponse du support',
    body: 'Vous avez reçu une réponse à votre ticket',
    data: {
      type: 'ticket' as const,
      ticketId,
      action: 'admin_response',
    },
  }),

  // Notifications remboursement
  refundProcessedClient: (userId: string, bookingId: string, amount: number) => ({
    userId,
    title: 'Remboursement effectué',
    body: `Un remboursement de ${amount.toFixed(2)}€ a été traité sur votre réservation`,
    data: {
      type: 'refund' as const,
      bookingId,
      action: 'processed',
    },
  }),

  refundProcessedHairdresser: (hairdresserId: string, bookingId: string, amount: number, date: string) => ({
    userId: hairdresserId,
    title: 'Remboursement traité',
    body: `Un remboursement de ${amount.toFixed(2)}€ a été effectué sur votre prestation du ${date}`,
    data: {
      type: 'refund' as const,
      bookingId,
      action: 'processed',
    },
  }),
};
