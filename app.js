const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const OpenAI = require('openai');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración de la API de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION,
});

// Sesiones de usuarios
const userSessions = {};

// Contexto de la IA
const context = `

    👋 ¡Hola! Soy Empa 🤖✨, tu asistente virtual de Grupo Empatic y Acciones Empáticas.
    ¿Te quieres comunicar con Grupo Empatic o Acciones Empáticas? ¡Genial! 🎉

    📩 Compártenos tus datos para conocerte mejor:
    📝 Nombre
    🆔 DNI
    📧 Correo electrónico

    💡 ¿Desde Grupo Empatic, cómo podemos ayudarte?
    🔹 Información sobre servicios
    🔹 Agendar una consulta
    🔹 Hablar con un asesor

    📢 ¿Qué es Grupo Empatic?
    Grupo Empatic es una empresa especializada en consultoría y desarrollo de proyectos. Brindamos soluciones estratégicas y asesoramiento profesional en diversas áreas para impulsar el éxito de organizaciones y emprendedores.

    💼 Nuestros Servicios:
    ✅ Consultoría estratégica
    ✅ Gestión de proyectos
    ✅ Capacitación y desarrollo profesional
    ✅ Innovación y transformación digital

    📍 ¿Qué es Acciones Empáticas?
    Acciones Empáticas es una organización social enfocada en el desarrollo de proyectos que generan impacto positivo en comunidades vulnerables. Buscamos fortalecer el tejido social a través del voluntariado, la sostenibilidad y la colaboración.

    🎯 Misión
    🌎 Impulsamos el desarrollo sostenible de comunidades mediante proyectos de impacto social, fomentando el crecimiento de voluntarios empáticos.

    👀 Visión
    💡 Ser una plataforma social líder en la generación de cambios positivos a nivel nacional e internacional.

    💙 Nuestros Valores
    🤝 Empatía
    🚀 Innovación
    🌱 Sostenibilidad
    🔎 Transparencia

    📌 Objetivos Estratégicos
    🔹 Proyectos: Impactar comunidades vulnerables con iniciativas de cambio.
    🔹 Equipo: Crear una red sólida de voluntarios empáticos y comprometidos.
    🔹 Sostenibilidad: Generar alianzas estratégicas para asegurar estabilidad financiera.
    🔹 Posicionamiento: Potenciar la visibilidad y reputación como referentes en el sector.

    📩 ¡Contáctanos!
    ✉️ Escríbenos y descubre cómo puedes ser parte de Grupo Empatic o Acciones Empáticas.

    ✨ ¡Juntos podemos hacer la diferencia! 💛🌍

    🗨️ Respuestas rápidas:

        Si el usuario agradece o confirma que entendió, responde: "¡Perfecto! 😊 Si tienes más preguntas o necesitas ayuda, estoy aquí para ayudarte en lo que necesites. 🚀"*
        Si el usuario necesita más información, responde: "Disculpa, no entendí bien lo que me quieres decir. ¿Podrías explicarlo de otra manera o darme más detalles?"
`;

// Función para obtener la respuesta de la IA
async function getAIResponse(userId, message) {
    let contextToSend = userSessions[userId] || context;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: contextToSend },
                { role: 'user', content: message }
            ],
            max_tokens: 2000,
            temperature: 0.2,
            top_p: 0.9,
            frequency_penalty: 0.2,
            presence_penalty: 0.3,
        });

        const aiResponse = response.choices[0].message.content.trim();
        userSessions[userId] = `${contextToSend}\nUser: ${message}\nAI: ${aiResponse}`;
        logChat(userId, message, aiResponse);
        return aiResponse;

    } catch (error) {
        console.error('Error al obtener respuesta de la IA:', error);
        return 'Lo siento, hubo un problema al procesar tu solicitud. Por favor, intenta de nuevo más tarde.';
    }
}

// Función para registrar el chat en un log
function logChat(userId, userMessage, aiResponse) {
    const logEntry = {
        userId,
        userMessage,
        aiResponse,
        timestamp: new Date().toISOString(),
    };

    fs.appendFileSync(
        path.join(__dirname, 'core.class.log'),
        JSON.stringify(logEntry) + '\n',
        'utf8'
    );
}

// Flujo del bot de WhatsApp
const defaultFlow = addKeyword(['.*'])
    .addAction(async (ctx, { flowDynamic }) => {
        const userId = ctx.from;
        const aiResponse = await getAIResponse(userId, ctx.body);
        await flowDynamic([{ body: aiResponse }]);
    });

// Iniciar el bot de WhatsApp
const main = async () => {
    const adapterDB = new MockAdapter();
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: createFlow([defaultFlow]),
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb({ port: process.env.PORT || 3000 });
};

// **NUEVO: Servidor Express para la Web**
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors()); // Permite que WordPress pueda comunicarse con el bot

// Ruta API para manejar el chatbot desde la web
app.post('/chat', async (req, res) => {
    const { userId, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío' });

    const aiResponse = await getAIResponse(userId || 'web-user', message);
    res.json({ reply: aiResponse });
});

// Iniciar servidor Express
app.listen(port, () => {
    console.log(`Servidor web activo en http://localhost:${port}`);
});

// Ejecutar el bot de WhatsApp
main().catch((error) => {
    console.error('Error en la función principal:', error);
});