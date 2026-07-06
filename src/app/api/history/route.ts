import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET — Récupérer l'historique de l'utilisateur connecté
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const todayOnly = searchParams.get('today') === 'true';

    let query = supabase
      .from('analysis_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (todayOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      console.error('[HISTORY] Error fetching:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: data || [] });
  } catch (e) {
    console.error('[HISTORY] GET error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — Sauvegarder une nouvelle analyse
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const {
      team1_id, team1_name, team1_logo, team1_league,
      team2_id, team2_name, team2_logo, team2_league,
      competition, score, confidence, summary,
      is_finished, win_prob, draw_prob, lose_prob, analysis_data
    } = body;

    const { data, error } = await supabase
      .from('analysis_history')
      .insert({
        user_id: user.id,
        team1_id, team1_name, team1_logo, team1_league,
        team2_id, team2_name, team2_logo, team2_league,
        competition, score, confidence, summary,
        is_finished: is_finished || false,
        win_prob, draw_prob, lose_prob,
        analysis_data: analysis_data || null
      })
      .select()
      .single();

    if (error) {
      console.error('[HISTORY] Error inserting:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (e) {
    console.error('[HISTORY] POST error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — Supprimer une analyse spécifique
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all') === 'true';

    let query;
    if (all) {
      query = supabase.from('analysis_history').delete().eq('user_id', user.id);
    } else if (id) {
      query = supabase.from('analysis_history').delete().eq('id', id).eq('user_id', user.id);
    } else {
      return NextResponse.json({ error: 'Paramètre manquant' }, { status: 400 });
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[HISTORY] DELETE error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
