import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { gameId, secret, questions } = await request.json();
    if (!secret || secret !== process.env.NEXT_SECRET) {
      return NextResponse.json({ error: "Not Authorised" }, { status: 404 });
    }
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const questionsWithGameId = {
      question_text: questions.text,
      options: questions.choices,
      correct_answer: questions.answer,
      game_id: gameId,
      order_index: game.current_question ?? 0 + 1,
    };

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questionsWithGameId);

    if (questionsError) {
      throw questionsError;
    }

    return NextResponse.json({ success: "Question Added" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add questions", details: error },
      { status: 500 }
    );
  }
}
