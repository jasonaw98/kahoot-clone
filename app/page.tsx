"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Clock, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  game_id: string;
  name: string;
  score: number;
  joined_at: string;
}

interface Question {
  id: string;
  game_id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  time_limit: number;
  order_index: number;
}

interface GameState {
  id: string;
  status: "waiting" | "active" | "finished";
  current_question: number;
  created_at: string;
  updated_at: string;
}

interface CustomQuestionForm {
  question_text: string;
  options: string[];
  correct_answer: number | null;
  time_limit: number;
}
// Sample questions for the demo
const sampleQuestions = [
  {
    question_text: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correct_answer: 2,
    time_limit: 30,
    order_index: 0,
  },
  {
    question_text: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correct_answer: 1,
    time_limit: 30,
    order_index: 1,
  },
  {
    question_text: "What is 3 x 2?",
    options: ["3", "4", "5", "6"],
    correct_answer: 3,
    time_limit: 20,
    order_index: 2,
  },
  {
    question_text: "Who is more good looking?",
    options: ["Pedro Pascal", "Brad Pitt", "Chris Evans", "Tom Holand"],
    correct_answer: 2,
    time_limit: 20,
    order_index: 3,
  },
];

export default function KahootClone() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [playerName, setPlayerName] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);

  const [customQuestions, setCustomQuestions] = useState<CustomQuestionForm[]>(
    []
  );
  const [currentCustomQuestion, setCurrentCustomQuestion] =
    useState<CustomQuestionForm>({
      question_text: "",
      options: ["", "", "", ""],
      correct_answer: null,
      time_limit: 30,
    });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!gameId) return;

    console.log("Setting up real-time subscriptions for game:", gameId);
    loadPlayers();

    // Subscribe to game state changes
    const gameChannel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log("Game state updated from subscription:", payload.new);
          const newGameState = payload.new as GameState;
          setGameState(newGameState);

          if (newGameState.status === "active") {
            console.log(
              "Game became active, loading question:",
              newGameState.current_question
            );
            if (questions.length === 0) {
              console.log("No questions loaded, reloading...");
              loadQuestions(gameId);
            } else {
              console.log("Questions already loaded, setting current question");
              loadCurrentQuestion(newGameState.current_question);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Game channel subscription status:", status);
      });

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
        (payload) => {
          console.log("Player event received:", payload.eventType, payload.new);
          loadPlayers();
        }
      )
      .subscribe((status) => {
        console.log("Players channel subscription status:", status);
      });

    return () => {
      console.log("Cleaning up subscriptions");
      gameChannel.unsubscribe();
      playersChannel.unsubscribe();
    };
  }, [gameId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0 && gameState?.status === "active") {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && currentQuestion && !answerSubmitted) {
      // Auto-submit when time runs out
      submitAnswer(-1); // -1 indicates no answer
    } else if (timeLeft === 0 && isHost && currentQuestion) {
      // If host and time is up, automatically move to next question
      console.log("Time's up! Host automatically advancing to next question");
      setTimeout(() => {
        nextQuestion();
      }, 1000); // Show results for 3 seconds before moving on
    }
  }, [timeLeft, gameState?.status, currentQuestion, answerSubmitted, isHost]);

  const loadPlayers = async () => {
    if (!gameId) return;

    console.log("Loading players for game:", gameId);

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .order("score", { ascending: false });

    if (error) {
      console.error("Error loading players:", error);
      return;
    }

    console.log("Loaded players:", data);
    setPlayers(data || []);
  };

  const loadQuestions = async (gameId: string) => {
    console.log("Loading questions for game:", gameId);

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("game_id", gameId)
      .order("order_index");

    if (error) {
      console.error("Error loading questions:", error);
      return;
    }

    console.log("Questions loaded:", data);
    setQuestions(data || []);

    if (gameState?.status === "active") {
      console.log("Game is active, loading current question immediately");
      if (data && data.length > gameState.current_question) {
        const question = data[gameState.current_question];
        console.log("Setting current question immediately:", question);
        setCurrentQuestion(question);
        setTimeLeft(question.time_limit);
        setSelectedAnswer(null);
        setAnswerSubmitted(false);
      }
    }
  };

  const loadCurrentQuestion = async (questionIndex: number) => {
    console.log("loadCurrentQuestion called with index:", questionIndex);
    console.log("Available questions:", questions.length, questions);

    if (questions.length > questionIndex) {
      const question = questions[questionIndex];
      console.log("Setting current question:", question);
      setCurrentQuestion(question);
      setTimeLeft(question.time_limit);
      setSelectedAnswer(null);
      setAnswerSubmitted(false);
    } else {
      console.error(
        "No question found at index:",
        questionIndex,
        "out of",
        questions.length,
        "questions"
      );
      // If we're in an active game but don't have the question, try to reload questions
      if (gameState?.status === "active") {
        console.log(
          "Attempting to reload questions since we're missing the current one"
        );
        await loadQuestions(gameState.id);
      }
    }
  };

  const createGame = async () => {
    const newGameId = Math.floor(100000 + Math.random() * 900000).toString();
    setGameId(newGameId);

    try {
      // Create game
      console.log("Creating game record...");
      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert({ id: newGameId })
        .select()
        .single();

      if (gameError) {
        console.error("Game creation error:", gameError);
        throw gameError;
      }
      console.log("Game created:", game);
      setGameState(game);

      // Insert questions
      console.log("Inserting questions...");
      const questionsToInsert = sampleQuestions.map((q, i) => ({
        ...q,
        game_id: newGameId,
        order_index: i,
      }));

      const { error: questionsError } = await supabase
        .from("questions")
        .insert(questionsToInsert);

      if (questionsError) {
        console.error("Questions creation error:", questionsError);
        throw questionsError;
      }
      console.log("Questions created successfully");

      // Join as host
      console.log("Adding host as player...");
      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          game_id: newGameId,
          name: playerName,
        })
        .select()
        .single();

      if (playerError) {
        console.error("Player creation error:", playerError);
        throw playerError;
      }
      console.log("Host player created:", player);

      // setGameState(game)
      setCurrentPlayer(player);
      setGameCode(newGameId);
      setIsHost(true);

      await loadQuestions(newGameId);
      await loadPlayers();

      console.log("Game setup complete");
    } catch (error) {
      console.error("Error creating game:", error);
      alert("Failed to create game. Please try again.");
    }
  };

  const joinGame = async () => {
    if (!playerName || !gameCode) {
      console.log("Missing player name or game code");
      return;
    }

    console.log("Attempting to join game:", gameCode, "as", playerName);

    try {
      // Check if game exists
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameCode)
        .single();

      if (gameError || !game) {
        console.error("Game not found:", gameError);
        alert("Game not found!");
        return;
      }
      console.log("Found game:", game);

      // Join game
      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          game_id: gameCode,
          name: playerName,
        })
        .select()
        .single();

      if (playerError) {
        console.error("Player join error:", playerError);
        if (playerError.code === "23505") {
          alert("Name already taken in this game!");
        } else {
          alert("Failed to join game!");
        }
        return;
      }
      console.log("Player joined:", player);

      setGameState(game);
      setGameId(game.id); // right after setGameState
      setCurrentPlayer(player);
      await loadQuestions(gameCode);
      await loadPlayers();

      console.log("Join complete");
    } catch (error) {
      console.error("Error joining game:", error);
      alert("Failed to join game. Please try again.");
    }
  };

  const startGame = async () => {
    if (!gameState || !isHost) {
      console.log("Cannot start game:", { gameState: !!gameState, isHost });
      return;
    }

    console.log("Starting game with players:", players.length);

    if (players.length < 1) {
      alert("Need at least 1 player to start!");
      return;
    }

    try {
      console.log("Updating game state to active in database...");
      const { error, data } = await supabase
        .from("games")
        .update({
          status: "active",
          current_question: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameState.id)
        .select();

      if (error) {
        console.error("Error starting game:", error);
        throw error;
      }

      console.log("Game started successfully, updated data:", data);

      // Force update the local game state to ensure UI updates
      if (data && data[0]) {
        console.log("Manually updating local game state");
        setGameState(data[0]);
      }
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Failed to start game!");
    }
  };

  const checkAllPlayersAnswered = async () => {
    if (!gameState || !currentQuestion) return;

    try {
      // Get all answers for the current question
      const { data: answers, error } = await supabase
        .from("answers")
        .select("player_id")
        .eq("question_id", currentQuestion.id);

      if (error) {
        console.error("Error checking answers:", error);
        return;
      }

      // If all players have answered, move to next question
      const uniquePlayerIds = new Set(answers?.map((a) => a.player_id) || []);
      console.log(
        `${uniquePlayerIds.size} of ${players.length} players have answered`
      );

      if (uniquePlayerIds.size >= players.length) {
        console.log("All players have answered, advancing to next question");
        setTimeout(() => {
          nextQuestion();
        }, 1000); // Show results for 3 seconds before moving on
      }
    } catch (error) {
      console.error("Error checking if all players answered:", error);
    }
  };

  const submitAnswer = async (answerIndex: number) => {
    if (!currentPlayer || !currentQuestion || answerSubmitted) return;

    setSelectedAnswer(answerIndex);
    setAnswerSubmitted(true);

    // Calculate score based on speed and correctness
    const isCorrect = answerIndex === currentQuestion.correct_answer;
    const speedBonus = Math.max(0, timeLeft * 10);
    const points = isCorrect ? 100 + speedBonus : 0;

    try {
      // Record the answer
      await supabase.from("answers").insert({
        player_id: currentPlayer.id,
        question_id: currentQuestion.id,
        selected_answer: answerIndex,
        response_time: (currentQuestion.time_limit - timeLeft) * 1000,
        points_earned: points,
      });

      // Update player score
      const newScore = currentPlayer.score + points;
      await supabase
        .from("players")
        .update({ score: newScore })
        .eq("id", currentPlayer.id);

      setCurrentPlayer({ ...currentPlayer, score: newScore });

      checkAllPlayersAnswered();
    } catch (error) {
      console.error("Error submitting answer:", error);
    }
  };

  const nextQuestion = async () => {
    if (!gameState) return;

    const nextQuestionIndex = gameState.current_question + 1;
    if (nextQuestionIndex < questions.length) {
      await supabase
        .from("games")
        .update({
          current_question: nextQuestionIndex,
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameState.id);
    } else {
      await supabase
        .from("games")
        .update({
          status: "finished",
          updated_at: new Date().toISOString(),
        })
        .eq("id", gameState.id);
    }
  };

  // Load current question when game state changes
  useEffect(() => {
    console.log("Game state effect triggered:", {
      status: gameState?.status,
      current_question: gameState?.current_question,
      questions_length: questions.length,
      questions: questions,
    });

    if (gameState?.status === "active" && questions.length > 0) {
      console.log("Loading question for active game");
      loadCurrentQuestion(gameState.current_question);
    }
  }, [gameState?.current_question, gameState?.status, questions]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {" "}
                {editingIndex !== null
                  ? "Edit Question"
                  : "Create Custom Questions"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Question Text
                </label>
                <input
                  type="text"
                  value={currentCustomQuestion.question_text}
                  onChange={(e) =>
                    setCurrentCustomQuestion({
                      ...currentCustomQuestion,
                      question_text: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="Enter your question"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Options
                </label>
                {currentCustomQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={currentCustomQuestion.correct_answer === index}
                      onChange={() =>
                        setCurrentCustomQuestion({
                          ...currentCustomQuestion,
                          correct_answer: index,
                        })
                      }
                      className="mr-2"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...currentCustomQuestion.options];
                        newOptions[index] = e.target.value;
                        setCurrentCustomQuestion({
                          ...currentCustomQuestion,
                          options: newOptions,
                        });
                      }}
                      className="w-full p-2 border rounded"
                      placeholder={`Option ${index + 1}`}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Time Limit (seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={currentCustomQuestion.time_limit}
                  onChange={(e) =>
                    setCurrentCustomQuestion({
                      ...currentCustomQuestion,
                      time_limit: parseInt(e.target.value) || 30,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="flex justify-between pt-4">
                {editingIndex !== null ? (
                  <>
                    <Button
                      onClick={() => {
                        // Save the edited question
                        const updatedQuestions = [...customQuestions];
                        updatedQuestions[editingIndex] = currentCustomQuestion;
                        setCustomQuestions(updatedQuestions);
                        setEditingIndex(null);
                        // Reset form
                        setCurrentCustomQuestion({
                          question_text: "",
                          options: ["", "", "", ""],
                          correct_answer: null,
                          time_limit: 30,
                        });
                      }}
                    >
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingIndex(null);
                        // Reset form
                        setCurrentCustomQuestion({
                          question_text: "",
                          options: ["", "", "", ""],
                          correct_answer: null,
                          time_limit: 30,
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      if (currentCustomQuestion.question_text.trim() === "") {
                        alert("Please enter a question");
                        return;
                      }
                      if (
                        currentCustomQuestion.options.some(
                          (opt) => opt.trim() === ""
                        )
                      ) {
                        alert("Please fill in all options");
                        return;
                      }
                      if (currentCustomQuestion.correct_answer === null) {
                        alert("Please select the correct answer");
                        return;
                      }

                      setCustomQuestions([
                        ...customQuestions,
                        currentCustomQuestion,
                      ]);
                      setCurrentCustomQuestion({
                        question_text: "",
                        options: ["", "", "", ""],
                        correct_answer: null,
                        time_limit: 30,
                      });
                    }}
                  >
                    Add Question
                  </Button>
                )}
              </div>

              {customQuestions.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">
                    Your Questions ({customQuestions.length})
                  </h3>
                  <div className="max-h-40 overflow-y-auto border rounded p-2">
                    {customQuestions.map((q, i) => (
                      <div
                        key={i}
                        className="mb-2 pb-2 border-b last:border-b-0 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">
                            {i + 1}. {q.question_text}
                          </div>
                          <div className="text-sm text-gray-600">
                            Correct: {q.options[q.correct_answer as number]} |
                            Time: {q.time_limit}s
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCurrentCustomQuestion(q);
                              setEditingIndex(i);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const updatedQuestions = [...customQuestions];
                              updatedQuestions.splice(i, 1);
                              setCustomQuestions(updatedQuestions);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-2"
                    onClick={async () => {
                      if (customQuestions.length === 0) {
                        alert("Please add at least one question");
                        return;
                      }
                      setIsDialogOpen(false);
                      const newGameId = Math.floor(
                        100000 + Math.random() * 900000
                      ).toString();
                      setGameId(newGameId);

                      try {
                        // Create game
                        const { data: game, error: gameError } = await supabase
                          .from("games")
                          .insert({ id: newGameId })
                          .select()
                          .single();

                        if (gameError) throw gameError;
                        setGameState(game);

                        // Insert custom questions
                        const questionsToInsert = customQuestions.map(
                          (q, i) => ({
                            ...q,
                            game_id: newGameId,
                            order_index: i,
                          })
                        );

                        const { error: questionsError } = await supabase
                          .from("questions")
                          .insert(questionsToInsert);

                        if (questionsError) throw questionsError;

                        // Join as host
                        const { data: player, error: playerError } =
                          await supabase
                            .from("players")
                            .insert({
                              game_id: newGameId,
                              name: playerName,
                            })
                            .select()
                            .single();

                        if (playerError) throw playerError;

                        setCurrentPlayer(player);
                        setGameCode(newGameId);
                        setIsHost(true);

                        await loadQuestions(newGameId);
                        await loadPlayers();
                      } catch (error) {
                        console.error("Error creating game:", error);
                        alert("Failed to create game. Please try again.");
                      }
                    }}
                  >
                    Create Game
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>

          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-purple-600">
                Quiz Battle
              </CardTitle>
              <p className="text-gray-600">Real-time multiplayer quiz game</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  maxLength={20}
                />
                <input
                  type="text"
                  placeholder="Game code (to join)"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  className="w-full p-3 border rounded-lg"
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Button
                  onClick={joinGame}
                  className="w-full"
                  disabled={!playerName || !gameCode}
                >
                  Join Game
                </Button>
                <Button
                  onClick={createGame}
                  variant="outline"
                  className="w-full bg-transparent"
                  disabled={!playerName}
                >
                  Use Sample Questions
                </Button>
                <DialogTrigger
                  disabled={!playerName}
                  className={cn(
                    "bg-purple-500 w-full p-2 rounded-lg cursor-pointer text-white font-semibold",
                    !playerName ? "bg-purple-200" : "hover:bg-purple-600"
                  )}
                >
                  Create Custom Game
                </DialogTrigger>
              </div>
            </CardContent>
          </Card>
        </Dialog>
      </div>
    );
  }

  if (gameState.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">
              Game Code: {gameState.id} {isHost ? "Host" : "No"}
            </CardTitle>
            <p className="text-gray-600">Waiting for players to join...</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  <span>{players.length} players joined</span>
                </div>
                <span>Current Player: {currentPlayer?.name || "None"}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-center text-center p-3 bg-gray-100 rounded-lg"
                  >
                    <span className="font-medium">{player.name}</span>
                  </div>
                ))}
              </div>

              {isHost && (
                <Button
                  onClick={startGame}
                  className="w-full mt-4"
                  disabled={players.length < 1}
                >
                  Start Game (
                  {customQuestions.length > 0
                    ? customQuestions.length
                    : questions.length}{" "}
                  questions)
                </Button>
              )}

              {!isHost && (
                <p className="text-center text-gray-600">
                  Waiting for host to start the game...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState.status === "active" && currentQuestion) {
    const showResults = answerSubmitted;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span
                className={`text-xl font-bold ${
                  timeLeft <= 5 ? "text-red-300 animate-pulse" : ""
                }`}
              >
                {timeLeft}s
              </span>
              {timeLeft <= 10 && (
                <span className="text-red-300 animate-pulse ml-2">
                  {timeLeft <= 5 ? "Time's almost up!" : "Hurry!"}
                </span>
              )}
            </div>
            <div className="text-center">
              <div className="text-sm opacity-80">
                Question {gameState.current_question + 1} of {questions.length}
              </div>
              {currentPlayer && (
                <div className="text-lg font-bold">
                  Your Score: {currentPlayer.score}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{players.length}</span>
            </div>
          </div>

          {/* Question */}
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-8">
                {currentQuestion.question_text}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, index) => {
                  let buttonVariant:
                    | "default"
                    | "outline"
                    | "destructive"
                    | "secondary" = "outline";
                  let buttonClass = "p-6 text-lg h-auto";

                  if (showResults) {
                    if (index === currentQuestion.correct_answer) {
                      buttonVariant = "default";
                      buttonClass +=
                        " bg-green-500 hover:bg-green-600 text-white";
                    } else if (selectedAnswer === index) {
                      buttonVariant = "destructive";
                    }
                  } else if (selectedAnswer === index) {
                    buttonVariant = "secondary";
                  }

                  return (
                    <Button
                      key={index}
                      onClick={() => submitAnswer(index)}
                      disabled={answerSubmitted || timeLeft === 0}
                      variant={buttonVariant}
                      className={buttonClass}
                    >
                      {option}
                      {showResults &&
                        index === currentQuestion.correct_answer && (
                          <Zap className="w-4 h-4 ml-2" />
                        )}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Live Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        player.id === currentPlayer?.id
                          ? "bg-blue-100 border-2 border-blue-300"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          #{index + 1}
                        </Badge>
                        <span className="font-medium">{player.name}</span>
                        {player.id === currentPlayer?.id && (
                          <Badge variant="secondary" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <span className="font-bold">{player.score} pts</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (gameState.status === "finished") {
    const winner = players.sort((a, b) => b.score - a.score)[0];
    const playerRank =
      players
        .sort((a, b) => b.score - a.score)
        .findIndex((p) => p.id === currentPlayer?.id) + 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">
              🎉 Winner:{" "}
              <span className="font-bold text-purple-600">{winner?.name}</span>
            </CardTitle>
            {currentPlayer && (
              <p className="text-lg font-bold">
                You finished #{playerRank} with {currentPlayer.score} points!
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-center">
                Final Leaderboard
              </h3>
              <div className="space-y-2">
                {players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        index === 0
                          ? "bg-yellow-100 border-1 border-yellow-400"
                          : index === 1
                          ? "bg-gray-100 border-1 border-gray-400"
                          : index === 2
                          ? "bg-orange-100 border-1 border-orange-400"
                          : "bg-gray-50"
                      } ${player.id === currentPlayer?.id ? "border-4" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={index < 3 ? "default" : "secondary"}
                          className="text-lg px-3 py-1"
                        >
                          {index + 1}
                        </Badge>
                        <span className="font-medium text-lg">
                          {player.name}
                        </span>
                        {player.id === currentPlayer?.id && (
                          <Badge variant="outline">You</Badge>
                        )}
                      </div>
                      <span className="font-bold text-xl">
                        {player.score} pts
                      </span>
                    </div>
                  ))}
              </div>
              <Button
                onClick={() => window.location.reload()}
                className="w-full mt-6"
              >
                Play Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
