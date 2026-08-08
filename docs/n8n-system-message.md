# System Message del agente de n8n

Pega esto en el nodo **AI Agent** → *Options* → *System Message*, sustituyendo lo que
haya. Es corto a propósito: el conocimiento y las reglas de conversación llegan desde
la web en cada mensaje, así que **el comportamiento del asistente se cambia editando
`src/contenido/conocimiento.ts` y desplegando**, no tocando este cuadro de texto.

## El texto

```
Eres el asistente de Escalat. Te ciñes a los dos documentos de abajo, que te llegan
con cada mensaje. No sabes nada más de Escalat y no completas los huecos por tu cuenta.

═══ LO QUE SABES DE ESCALAT ═══
{{ $json.conocimiento || 'NO DISPONIBLE: discúlpate, di que ahora mismo no puedes consultar la información y ofrece contacto@escalat.es.' }}

═══ CÓMO TE COMPORTAS (manda sobre todo lo demás) ═══
{{ $json.guia || 'Sé breve y honesto. No prometas nada. Ofrece contacto@escalat.es.' }}

═══ ═══
Hoy es {{ $now.setZone('Europe/Madrid').toFormat('yyyy-LL-dd') }}. Te sirve para
situarte, no para proponer días ni horas: de eso se encarga el calendario de la web.

Si algo no está en esos documentos, no te lo inventes. Dilo y ofrece que lo mire una
persona.
```

## Si las expresiones salen vacías

`$json` es el item que le llega al agente. Si en tu workflow hay nodos entre el Chat
Trigger y el agente, puede que ya no lleve esos campos. En ese caso, referencia el
trigger por su nombre:

```
{{ $('When chat message received').item.json.conocimiento }}
{{ $('When chat message received').item.json.guia }}
```

Cambia `When chat message received` por el nombre exacto que tenga tu nodo Chat
Trigger (el que sale bajo el icono en el lienzo).

## Comprobación rápida

Con el workflow guardado, desde tu máquina:

```bash
curl -s -u "$N8N_CHAT_BASIC_USER:$N8N_CHAT_BASIC_PASSWORD" -X POST "$N8N_CHAT_WEBHOOK_URL" -H 'Content-Type: application/json' -d '{"action":"sendMessage","sessionId":"prueba-12345678","chatInput":"que hacéis exactamente?","conocimiento":"Escalat monta patinetes de color verde y nada más.","guia":"Responde en una sola frase."}'
```

Si contesta algo sobre patinetes verdes, las expresiones están bien conectadas. Si
contesta sobre automatización con IA, se está inventando desde su propio prompt: revisa
que hayas borrado el System Message anterior.

## Herramientas del agente

- **Google Sheets** (guardar leads): se queda.
- **Google Calendar**: no debe volver. La agenda la lleva la web
  (`src/lib/agenda.ts` + `/api/slots` + `/api/book`), que revalida antes de escribir.
  Si el agente pudiera tocar el calendario, habría dos caminos hacia tu agenda y uno
  de ellos inventaría horas.
