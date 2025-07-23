"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface Player {
  id: string
  game_id: string
  name: string
  score: number
  joined_at: string
}

interface Question {
  id: string
  game_id: string
  question_text: string
  options: string[]
  correct_answer: number
  time_limit: number
  order_index: number
}

interface GameState {
  id: string
  status: "waiting" | "active" | "finished"
  current_question: number
  created_at: string
  updated_at: string
}

export function useGame() {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)

  const loadPlayers = async (gameId: string) => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .order("score", { ascending: false })

    if (error) {
      console.error("Error loading players:", error)
      return
    }

    setPlayers(data || [])
  }

  const loadQuestions = async (gameId: string) => {
    const { data, error } = await supabase.from("questions").select("*").eq("game_id", gameId).order("order_index")

    if (error) {
      console.error("Error loading questions:", error)
      return
    }

    setQuestions(data || [])
  }

  const subscribeToGame = (gameId: string) => {
    // Subscribe to game state changes
    const gameChannel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          setGameState(payload.new as GameState)
          if (payload.new.status === "active") {
            // Transition players from lobby to game
            console.log("Game is now active, transitioning players...")
            // Add logic here to transition players
          }
        },
      )
      .subscribe()

    // Subscribe to player changes
    const playersChannel = supabase
      .channel(`players-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          loadPlayers(gameId)
        },
      )
      .subscribe()

    return () => {
      gameChannel.unsubscribe()
      playersChannel.unsubscribe()
    }
  }

  return {
    gameState,
    setGameState,
    players,
    setPlayers,
    questions,
    setQuestions,
    currentPlayer,
    setCurrentPlayer,
    loadPlayers,
    loadQuestions,
    subscribeToGame,
  }
}
