import { NextResponse } from 'next/server';
import { agentModel } from '@/lib/gemini';
import { toolsDeclaration, executeTool } from '@/lib/tools';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'El mensaje es requerido.' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Formatear el historial de chat al esquema que espera Gemini
    const formattedHistory = (history || []).map((msg: any) => {
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
      const text = msg.content || msg.text || '';
      return {
        role,
        parts: [{ text }],
      };
    });

    console.log(`[Agente IA] Iniciando chat con historial de longitud ${formattedHistory.length}`);

    // Iniciar chat con las herramientas registradas
    const chat = agentModel.startChat({
      history: formattedHistory,
      tools: [{ functionDeclarations: toolsDeclaration }],
    });

    // Enviar el nuevo mensaje del usuario
    let result = await chat.sendMessage(message);
    
    // Obtener llamadas a funciones (si existen)
    let functionCalls = result.response.functionCalls();
    let lastToolUsed: string | null = null;

    // Loop de Function Calling (Gemini puede encadenar llamadas secuenciales)
    while (functionCalls && functionCalls.length > 0) {
      const toolResponses = [];

      for (const call of functionCalls) {
        lastToolUsed = call.name;
        // Ejecutar la query correspondiente en la base de datos PHP
        const toolOutput = await executeTool(call.name, call.args);

        toolResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: toolOutput },
          },
        });
      }

      // Devolver los resultados de la BD a Gemini para que continúe la conversación
      result = await chat.sendMessage(toolResponses);
      functionCalls = result.response.functionCalls();
    }

    const reply = result.response.text();

    return NextResponse.json(
      {
        success: true,
        reply,
        tool_used: lastToolUsed,
      },
      {
        headers: corsHeaders
      }
    );

  } catch (error: any) {
    console.error('[Agente IA] Error en el endpoint de chat:', error);
    return NextResponse.json(
      { 
        success: false, 
        reply: 'Lo siento, ha ocurrido un error al procesar tu solicitud con el agente de inteligencia.',
        error: error.message || 'Error interno del servidor' 
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
