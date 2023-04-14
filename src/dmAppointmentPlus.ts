import { TIMEOUT } from "dns";
import { title } from "process";
import { text } from "stream/consumers";
import { MachineConfig, send, Action, assign } from "xstate";

function say(text: string): Action<SDSContext, SDSEvent> {
  return send((_context: SDSContext) => ({ type: "SPEAK", value: text }));
}

interface Grammar {
  [index: string]: {
    intent: string;
    entities: {
      [index: string]: string;
    };
  };
}

const getIntent = (context: SDSContext, entity: string) => {
  console.log('nluResult:', context.nluResult);
  const topIntent = context.nluResult.prediction.intents[0];
  console.log('Top intent:', topIntent);
    return topIntent.category;
};

const getEntity = (context: SDSContext, entity: string) => {
  console.log('nluResult:', context.nluResult);
  const entities = context.nluResult.prediction.entities;
  console.log(entities.length)
  if (entities.length > 0) {
    return context.nluResult.prediction.entities[0].text;
} else {
  return false;
}
};



export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = {
  initial: "idle",
  states: {
    idle: {
      on: {
        CLICK: "init",
      },
    },
    init: {
      id: "init",
      on: {
        TTS_READY: "greeting",
        CLICK: "greeting",
      },
    },
  greeting: {
    id: "greeting",
    initial: "prompt",
    on: {
      RECOGNISED: [
        {
          target: "welcome",
          cond: (context)=>  getIntent(context) === "create a new meeting",
        },
        {
          target: "celebrity_info",
          cond: (context) => getIntent(context) === "Who is X",
        },
        {
          //target: ".helpline",
          target: ".helpline",
          cond: (context) => getIntent(context) === "helpline",
        },
        {
          target: ".end",
          cond: (context)=>getIntent(context) === "yes",
        },
        {
          target: ".nomatch",
        },
      ],
      TIMEOUT: [
        {
          target: "#ask_greeting",
        },
      ],
    },
    states: {
      prompt: {
        entry: say("Hello Stas! What would you like to do today: create a meeting or ask a celebrity question?"),
        on: {ENDSPEECH: "ask"},

      },
      ask:{ 
        id: "ask_greeting",
        entry: send("LISTEN"),
        on: {TIMEOUT: "#NOINPUT1_greeting"},
      },
      NOINPUT1:{
        id: "NOINPUT1_greeting",
        entry: say("What would you like to do?"),
        on: {ENDSPEECH: "#ask1_greeting"},
      },
      ask1:{
        id: "ask1_greeting",
        entry: send("LISTEN"),
        on: {TIMEOUT: "#NOINPUT2_greeting"},
      },
      NOINPUT2: {
        id: "NOINPUT2_greeting",
        entry: say("Are you here?"),
        on: {ENDSPEECH: "#ask2_greeting"},
      },
      ask2: {
        id: "ask2_greeting",
        entry: send("LISTEN"),
        on: {TIMEOUT: "#return"}
      },
      return: {
        id: "return",
        entry: say("Seems like you're not here. I'm finishing this session. Click on the button again if you wish to talk!"),
        on: {ENDSPEECH: "#init"},
      },
      nomatch: {
        entry: say("Sorry, I didn't quite get it. What was it?"),
        on: {ENDSPEECH: "#ask_greeting"},
      },
      helpline: {
        entry: say("Sure! Let's go back"),
        on: {ENDSPEECH: "#greeting"},
      },
      end: {
        entry: say("So would you like to create a meeting or ask a celebrity question?"),
        on: {ENDSPEECH: "#ask_celebrity"},
      },
    },
  },
  celebrity_info: {
    id:"celebrity_info",
    initial: "prompt",
    on: {
      RECOGNISED: [
        {
          target: ".information",
          actions: assign({title:
          context => {return context.recResult[0].utterance},
          }),
        },
        {
          target: ".helpline",
          cond: (context)=>getIntent(context) ==="helpline",
        },
        {
          target: ".end",
          cond: (context)=>getIntent(context) === "yes",
        },
        {
          target: ".nomatch",
        },
      ],
      TIMEOUT: [
        {
          target: "#ask_celebrity",
        },
      ],
    },
    states: {
      information: {
        invoke: {
          id: 'getInformation',
          src: (context, event) => kbRequest(context.title),
          onDone: [{
            target: 'success',
            cond: (context, event) => event.data.Abstract !== "",
            actions: assign({ information: (context, event) => event.data })
          },
          {
            target: 'helpline',
          },
          {
            target: 'failure',
          },
        ],
          onError: {
            target: 'failure',
          },
        },
      },
      success: {
        entry: send((context) => ({
          type: "SPEAK",
          value: `Here's what I found: ${context.information.Abstract}`
        })),
        on: {ENDSPEECH: "#meeting"},
      },
      failure: {
        entry: send((context) => ({
          type: "SPEAK",
          value: `Sorry, I don't know who that is. Tell me something I know.`
        })),
        on: {ENDSPEECH: "ask"},
      },
      prompt: {
        entry: say("What celebrity do you have in mind?"),
        on: { ENDSPEECH: "ask" },
      },
      ask:{ 
        id: "ask_celebrity",
        entry: send("LISTEN"),
        on: {TIMEOUT: "#NOINPUT1_celebrity"},
      },
      NOINPUT1:{
        id: "NOINPUT1_celebrity",
        entry: say("What celebrity have you chosen?"),
        on: {ENDSPEECH: "#ask1_celebrity"},
      },
      ask1:{
        id: "ask1_celebrity",
        entry: send("LISTEN"),
        on: {TIMEOUT: "#NOINPUT2_celebrity"},
      },
      NOINPUT2: {
        id: "NOINPUT2_celebrity",
        entry: say("Are you here?"),
        on: {ENDSPEECH: "#ask2_celebrity"},
      },
      ask2: {
        id: "ask2_celebrity",
        entry: send("LISTEN"),
        on: {TIMEOUT: "#return"}
      },
      return: {
        id: "return",
        entry: say("Seems like you're not here. I'm sending you back to the start."),
        on: {ENDSPEECH: "#init"},
      },
      nomatch: {
        entry: say(
          "Sorry, I don't know who it is. Tell me something I know."
        ),
        on: { ENDSPEECH: "#ask_celebrity" },
      },
      helpline: {
        entry: say("Sure, let's go back"),
        on: {ENDSPEECH: "#greeting"},
      },
      end: {
        entry: say("So what celebrity are you thinking of?"),
        on: {ENDSPEECH: "#ask_celebrity"},
      },
    },
  },
  meeting: {
    id: "meeting",
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "whichday",
            cond: (context) => getIntent(context) === "yes",

              //duration_y: (context) => getEntity(context, "duration_y"),
          },
          {
            target: ".helpline",
            cond: (context)=> getIntent(context) ==="helpline",
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: "#ask_meeting",
      },
      states: {
        prompt: {
          entry: say("Do you want to meet them?"),
          on: {ENDSPEECH: "ask" },
        },
        ask:{ 
          id: "ask_meeting",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#NOINPUT1_meeting"},
        },
        NOINPUT1:{
          id: "NOINPUT1_meeting",
          entry: say("Do you?"),
          on: {ENDSPEECH: "#ask1_meeting"},
        },
        ask1:{
          id: "ask1_meeting",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#NOINPUT2_meeting"},
        },
        NOINPUT2: {
          id: "NOINPUT2_meeting",
          entry: send((context)=>({
            type: "SPEAK",
            value: `Are you still interested in meeting ${context.title}?`,
          })),
          on: {ENDSPEECH: "#ask2_meeting"},
        },
        ask2: {
          id:"ask2_meeting",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#return"},
        },
        return: {
          id: "return",
          entry: say("Seems like you're not here. I'm sending you back to the start."),
          on: {ENDSPEECH: "#init"},
        },
        nomatch: {
          entry: say('So yes?'),
          on: {ENDSPEECH: "#ask_meeting"},
        },
        helpline: {
          entry: say("Sure, Let's go back!"),
          on: {ENDSPEECH: "#celebrity_info"},
        },
      },
    },
    welcome: {
      id: "welcome",
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "#info",
            cond: (context)=> getIntent(context)=== "appointment" && getEntity(context)!= false,
            actions: assign({
              title: (context)=> getEntity(context, "appointment"),
            }),
          },
          {
            target: ".helpline",
            cond: (context)=> getIntent(context) ==="helpline",
          },
          {
            target: ".nomatch",
            cond: (context)=> getEntity(context) === false,
          },
        ],
        TIMEOUT: ".prompt"
      },
      states: {
        prompt: {
          entry: say("What would the meeting be about?"),
          on: {ENDSPEECH: "ask"},
        },
        ask: {
          id: "ask_welcome",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#NOINPUT_welcome"},
        },
        NOINPUT1: {
          id: "NOINPUT_welcome",
          entry: say("What is is about?"),
          on: {ENDSPEECH: "#ask1_welcome"},
        },
        ask1: {
          id: "ask1_welcome",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#NOINPUT2_welcome"},
        },
        NOINPUT2: {
          id: "NOINPUT2_welcome",
          entry: say("Are you here?"),
          on: {ENDSPEECH: "#ask2_welcome"},
        },
        ask2: {
          id: "ask2_welcome",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#return"}
        },
        return: {
          id: "return",
          entry: say("Seems like you're not here. I'm sending you back to the start."),
          on: {ENDSPEECH: "#init"},
        },
        helpline: {
          entry: say("Sure! Let's go back"),
          on: {ENDSPEECH: "#greeting"},
        },
        end: {
          entry: say("So what would the meeting be about?"),
          on: {ENDSPEECH: "#ask_welcome"},
        },
        nomatch: {
          id: "nomatch",
          entry: say("Sorry, I don't know what that is. Tell me something that I know."),
          on: {ENDSPEECH: "#ask_welcome"},
        },
      },
    },

info: {
  id:"info",
  entry: send((context)=> ({
    type: "SPEAK",
    value: `OK, so ${context.title}, huh?`,
  })),
  on: {ENDSPEECH: "whichday"},
},

whichday: {
  id: "whichday",
  initial: "prompt",
  on: {
    RECOGNISED: [
      {
        target: "Date",
        cond: (context) => getIntent(context) === "day",
        actions: assign({
          day: (context) => getEntity(context, "day"),
        }),
      },
      {
        target: ".helpline",
        cond: (context) => getIntent(context)=== "helpline",
      },
      {
        target: ".end",
        cond: (context)=>getIntent(context)=== "yes",
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_whichday",
  },
  states: {
    prompt: {
      entry: say("On which day is it?"),
      on: { ENDSPEECH: "ask" },
    },
    ask: {
      id: "ask_whichday",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT1_whichday"},
    },
    NOINPUT1: {
      id: "NOINPUT1_whichday",
      entry: say("So on which day?"),
      on: {ENDSPEECH: "#ask1_whichday"},
    },
    ask1: {
      id: "ask1_whichday",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT2_whichday"},
    },
    NOINPUT2: {
      id: "NOINPUT2_whichday",
      entry: say("Are you here?"),
      on: {ENDSPEECH: "#ask2_whichday"},
    },
    ask2: {
      id: "ask2_whichday",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#return"}
    },
    return: {
      id: "return",
      entry: say("Seems like you're not here. I'm sending you back to the start."),
      on: {ENDSPEECH: "#init"},
    },
    nomatch: {
      entry: say(
        "Are you sure you are saying it correcrly? Try again!"
      ),
      on: { ENDSPEECH: "#ask_whichday" },
    },
    helpline: {
      entry: say("Sure! Let's go back!"),
      on: {ENDSPEECH: "#welcome"},
    },
    end: {
      entry: say("So on which day would the meeting be?"),
      on: {ENDSPEECH: "#ask_whichday"},
    },
  },
},

Date: {
  id: "Date",
  entry: send((context)=> ({
    type: "SPEAK",
    value: `OK, ${context.day} sounds like a good day!`,
  })),
  on: {ENDSPEECH: "askDuration"},
},

askDuration: {
  id: "askDuration",
  initial: "prompt",
  on: {
    RECOGNISED: [
      {
        target: "meeting_created_whole_day",
        cond: (context) => getIntent(context) === "yes",
      },
      {
        target: "what_time",
        cond: (context) => getIntent(context) === "no",
      },
      {
        target: ".helpline",
        cond: (context) => getIntent(context)=== "helpline",
      },
      {
        target: ".end",
        cond: (context)=>getIntent(context)=== "yes",
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_duration",
  },
  states: {
    prompt: {
      entry: say("Will it take the whole day?"),
      on: { ENDSPEECH: "ask" },
    },
    ask: {
      id: "ask_duration",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT1_askduration"},
    },
    NOINPUT1: {
      id: "NOINPUT1_askduration",
      entry: say("So will it take whole day?"),
      on: {ENDSPEECH: "#ask1_askduration"},
    },
    ask1: {
      id: "ask1_askduration",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT2_askduration"},
    },
    NOINPUT2: {
      id: "NOINPUT2_askduration",
      entry: say("Are you here?"),
      on: {ENDSPEECH: "#ask2_askduration"},
    },
    ask2: {
      id: "ask2_askduration",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#return"}
    },
    return: {
      id: "return",
      entry: say("Seems like you're not here. I'm sending you back to the start."),
      on: {ENDSPEECH: "#init"},
    },
    nomatch: {
      entry: say(
        "Sorry, come again?"
      ),
      on: { ENDSPEECH: "#ask_duration" },
    },
    helpline: {
      entry: say("Sure! Let's go back!"),
      on: {ENDSPEECH: "#whichday"},
    },
    end: {
      entry: say("So will the meeting take the whole day?"),
      on: {ENDSPEECH: "#ask_duration"},
    },
  },
},

meeting_created_whole_day: {
  id: "whole_day",
  initial: "prompt",
  on: {
    RECOGNISED: [
      {
        target: "endline",
        cond: (context) => getIntent(context) === "yes",
      },
      {
        target: ".cancel",
        cond: (context) => getIntent(context) === "no",
      },
      {
        target: ".helpline",
        cond: (context) => getIntent(context) === "helpline",
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_wholeday",
  },
  states: {
    prompt: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, do you want me to create a meeting titled ${context.title} on ${context.day} for the whole day?`,
        })),
      on: { ENDSPEECH: "ask" },
    },
    ask: {
      id: "ask_wholeday",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT1_wholeday"},
    },
    NOINPUT1: {
      id: "NOINPUT1_wholeday",
      entry: send((context)=> ({
        type: "SPEAK",
        value: `So, do you want me to create a meeting titled ${context.title} on ${context.day} for the whole day?`
      })),
      on: {ENDSPEECH: "#ask1_wholeday"},
    },
    ask1: {
      id: "ask1_wholeday",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT2_wholeday"},
    },
    NOINPUT2: {
      id: "NOINPUT2_wholeday",
      entry: say("Would you still like to create the meeting?"),
      on: {ENDSPEECH: "#ask2_wholeday"},
    },
    ask2: {
      id: "ask2_wholeday",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#return"}
    },
    nomatch: {
      entry: say(
        "So yes or no?"
      ),
      on: { ENDSPEECH: "#ask_wholeday" },
    },
    helpline: {
      entry: say("Sure! Let's go back!"),
      on: {ENDSPEECH: "#askDuration"},
    },
    return: {
      id: "return",
      entry: say("Seems like you're not here. I'm sending you back to the start."),
      on: {ENDSPEECH: "#init"},
    },
    cancel: {
      entry: say("Ok, I won't do that"),
      on: {ENDSPEECH: "#greeting"},
    },
  },
},

what_time: {
  id: "time",
  initial: "prompt",
  on: {
    RECOGNISED: [
      {
        target: "meeting_specific_time",
        cond: (context) => getIntent(context) === "time",
        actions: assign({
          time: (context) => getEntity(context, "time"),
        }),
      },
      {
        target: ".helpline",
        cond: (context) => getIntent(context)=== "helpline",
      },
      {
        target: ".end",
        cond: (context)=>getIntent(context)=== "yes",
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_whattime",
  },
  states: {
    prompt: {
      entry: say("What time is your meeting?"),
      on: { ENDSPEECH: "ask" },
    },
    ask: {
      id: "ask_whattime",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT1_whattime"},
    },
    NOINPUT1: {
      id: "NOINPUT1_whattime",
      entry: say("So what time are you thinking?"),
      on: {ENDSPEECH: "#ask1_whattime"},
    },
    ask1: {
      id: "ask1_whattime",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#NOINPUT2_whattime"},
    },
    NOINPUT2: {
      id: "NOINPUT2_whattime",
      entry: say("Are you here?"),
      on: {ENDSPEECH: "#ask2_whattime"},
    },
    ask2: {
      id: "ask2_whattime",
      entry: send("LISTEN"),
      on: {TIMEOUT: "#return"}
    },
    return: {
      id: "return",
      entry: say("Seems like you're not here. I'm sending you back to the start."),
      on: {ENDSPEECH: "#init"},
    },
    nomatch: {
      entry: say(
        "Could you say that again?"
      ),
      on: { ENDSPEECH: "#ask_whattime" },
    },
    helpline: {
      entry: say("Sure! Let's go back!"),
      on: {ENDSPEECH: "#whichday"},
    },
    end: {
      entry: say("So what time are you thinking?"),
      on: {ENDSPEECH: "#ask_whattime"},
    },
  },
},

meeting_specific_time:{
  id: "specific_time",
  initial: "prompt",
  on: {
    RECOGNISED: [
      {
        target: "welcome",
        cond: (context) => getIntent(context) === "no",
      },
      {
        target: "endline",
        cond: (context) => getIntent(context) === "yes",
      },
      {
        target: ".helpline",
        cond: (context) => getIntent(context)=== "helpline",
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_specifictime",
  },
  states: {
    prompt: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}?`,
        })),
      on: { ENDSPEECH: "#ask_specifictime" },
        },
        ask: {
          id: "ask_specifictime",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#NOINPUT1_specifictime"},
        },
        NOINPUT1: {
          id: "NOINPUT1_specifictime",
          entry: send((context)=> ({
            type: "SPEAK",
            value: `So, do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}?`
          })),
          on: {ENDSPEECH: "#ask1_specifictime"},
        },
        ask1: {
          id: "ask1_specifictime",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#NOINPUT2_specifictime"},
        },
        NOINPUT2: {
          id: "NOINPUT2_specifictime",
          entry: say("Would you still like to create a meeting?"),
          on: {ENDSPEECH: "#ask2_specifictime"},
        },
        ask2: {
          id: "ask2_specifictime",
          entry: send("LISTEN"),
          on: {TIMEOUT: "#return"}
        },
        return: {
          id: "return",
          entry: say("Seems like you're not here. I'm sending you back to the start."),
          on: {ENDSPEECH: "#init"},
        },
        nomatch: {
          entry: say("So yes or no?"),
          on: { ENDSPEECH: "#ask_specifictime" },
        },
        helpline: {
          entry: say("Sure! Let' go back!"),
          on: {ENDSPEECH: "#time"},
        },
  },
},

endline: {
  id: "endline",
  entry: send((context)=> ({
    type: "SPEAK",
    value: `OK, your meeting has been created!`,
  })),
},
 
    },
};

const kbRequest = (text: string) =>
  fetch(
    new Request(
      `https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`
    )
  ).then((data) => data.json());
