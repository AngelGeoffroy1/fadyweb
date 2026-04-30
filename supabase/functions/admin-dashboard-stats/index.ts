import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Booking = {
  status: string | null;
  total_price: number | string | null;
  payment_method: string | null;
  channel: string | null;
  funds_available_on: string | null;
  fady_commission_user: number | string | null;
  fady_commission_barber: number | string | null;
  created_at: string;
};

type Diploma = {
  verification_status: string | null;
};

const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmées',
  completed: 'Complétées',
  cancelled: 'Annulées',
  refund: 'Remboursées',
  past: 'Passées',
  en_cours: 'En cours',
};

const BOOKING_STATUS_ORDER = ['pending', 'confirmed', 'completed', 'cancelled', 'refund', 'past', 'en_cours'];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(date: Date) {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return months[date.getMonth()];
}

function isBillableFadyRevenueBooking(booking: Booking) {
  return (
    booking.payment_method === 'card' &&
    booking.status !== 'cancelled' &&
    booking.status !== 'refund' &&
    booking.channel !== null &&
    booking.funds_available_on !== null
  );
}

function getFadyRevenue(booking: Booking) {
  return Number(booking.fady_commission_user || 0) + Number(booking.fady_commission_barber || 0);
}

async function fetchAllRows<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string,
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: T[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to retrieve ${table}: ${error.message}`);
    }

    rows.push(...((data || []) as T[]));

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminData) {
      return new Response(
        JSON.stringify({ error: 'User is not an admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const [
      usersResult,
      hairdressersResult,
      bookings,
      diplomas,
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('hairdressers').select('id', { count: 'exact', head: true }),
      fetchAllRows<Booking>(
        supabase,
        'bookings',
        'status,total_price,payment_method,channel,funds_available_on,fady_commission_user,fady_commission_barber,created_at',
      ),
      fetchAllRows<Diploma>(supabase, 'hairdresser_diploma_verification', 'verification_status'),
    ]);

    if (usersResult.error) throw new Error(`Failed to count users: ${usersResult.error.message}`);
    if (hairdressersResult.error) throw new Error(`Failed to count hairdressers: ${hairdressersResult.error.message}`);

    const totalRevenue = round2(
      bookings
        .filter(isBillableFadyRevenueBooking)
        .reduce((sum, booking) => sum + getFadyRevenue(booking), 0),
    );

    const pendingDiplomas = diplomas.filter(d => d.verification_status === 'pending').length;
    const verifiedDiplomas = diplomas.filter(d => d.verification_status === 'verified').length;

    const statusCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
      const status = booking.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const bookingStatusStats = [
      ...BOOKING_STATUS_ORDER.filter(status => statusCounts[status] !== undefined),
      ...Object.keys(statusCounts).filter(status => !BOOKING_STATUS_ORDER.includes(status)),
    ].map(status => ({
      status: BOOKING_STATUS_LABELS[status] || status,
      count: statusCounts[status] || 0,
    }));

    const now = new Date();
    const monthlyStats = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: getMonthKey(date),
        month: getMonthLabel(date),
        users: 0,
        hairdressers: 0,
        bookings: 0,
        revenue: 0,
      };
    });
    const monthlyStatsByKey = new Map(monthlyStats.map(month => [month.key, month]));

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      monthlyUsers,
      monthlyHairdressers,
    ] = await Promise.all([
      fetchAllRows<{ created_at: string }>(supabase, 'users', 'created_at'),
      fetchAllRows<{ created_at: string }>(supabase, 'hairdressers', 'created_at'),
    ]);

    for (const userRow of monthlyUsers) {
      const createdAt = new Date(userRow.created_at);
      if (createdAt >= currentMonthStart && createdAt < nextMonth) {
        const month = monthlyStatsByKey.get(getMonthKey(createdAt));
        if (month) month.users += 1;
      }
    }

    for (const hairdresser of monthlyHairdressers) {
      const createdAt = new Date(hairdresser.created_at);
      if (createdAt >= currentMonthStart && createdAt < nextMonth) {
        const month = monthlyStatsByKey.get(getMonthKey(createdAt));
        if (month) month.hairdressers += 1;
      }
    }

    for (const booking of bookings) {
      const createdAt = new Date(booking.created_at);
      if (createdAt >= currentMonthStart && createdAt < nextMonth) {
        const month = monthlyStatsByKey.get(getMonthKey(createdAt));
        if (month) {
          month.bookings += 1;
          if (isBillableFadyRevenueBooking(booking)) {
            month.revenue = round2(month.revenue + getFadyRevenue(booking));
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        totalUsers: usersResult.count || 0,
        totalHairdressers: hairdressersResult.count || 0,
        totalBookings: bookings.length,
        totalRevenue,
        pendingDiplomas,
        verifiedDiplomas,
        monthlyStats: monthlyStats.map(({ key, ...month }) => month),
        bookingStatusStats,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('admin-dashboard-stats error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
