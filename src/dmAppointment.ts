import { getegid, title } from "process";
import { unstable_renderSubtreeIntoContainer } from "react-dom";
import { text } from "stream/consumers";
import { MachineConfig, send, Action, assign, actions } from "xstate";

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

const grammar: Grammar = {
  "create a new meeting" : {
    intent: "None",
    entities: { begining: "creating a meeting"}
  },
  "who is taylor swift" : {
    intent: "celeb",
    entities: {request: "who_it_is", celeb: "Taylor Swift"}
  },
  "ask a celebrity question": {
    intent: "title",
    entities: {title: "ask a celebrity question"},
  },
  lecture: {
    intent: "None",
    entities: { title: "Dialogue systems lecture" },
  },
  lunch: {
    intent: "None",
    entities: { title: "Lunch at the canteen" },
  },
  "on monday": {
    intent: "None",
    entities: { day: "Monday"}
  },
  "on tuesday": {
    intent: "None",
    entities: { day: "Tuesday"}
  },
  "on wednesday": {
    intent: "None",
    entities: { day: "Wednesday"},
  },
  "on thursday": {
    intent: "None",
    entities: { day: "Thursday"}
  },
  "on friday": {
    intent: "None",
    entities: { day: "Friday" },
  },
  "on saturday": {
    intent: "None",
    entities: { day: "Saturday" },
  },
  "on sunday": {
    intent: "None",
    entities: {day: "Sunday"},
  },
  "10 in the morning": {
    intent: "None",
    entities: { time: "10:00" },
  },
  "cars":{
    intent: "topic",
    entities: { title: "cars"},
  },
  "homework":{
    intent: "topic",
    entities: { title: "homework"},
  },
  "january 9th":{
    intent: "date",
    entities: {day: "January 9th"},
  },
  "tomorrow": {
    intent: "date",
    entities: {day: "tomorrow"},
  },
  "no":{
    intent: "duration_n",
    entities: {duration_n: "no"},
  },
  "I did": {
    intent: "confirmation",
    entities: {confirmation: "I did"},
  },
  "yes": {
    intent: "duration_y",
    entities: {duration_y: "yes"},
  },
  "2:00 PM.": {
    intent: "time",
    entities: {time: "2pm"},
  },
  "yes, please": {
    intent: "endline",
    entities: {endline: "yes"},
  },

};

const getEntity = (context: SDSContext, entity: string) => {
  // lowercase the utterance and remove tailing "."
  let u = context.recResult[0].utterance.toLowerCase().replace(/.$/g, "");
  if (u in grammar) {
    if (entity in grammar[u].entities) {
      return grammar[u].entities[entity];
    }
  }
};

const getEntity2 = (context: SDSContext, entity: string) => {
  // lowercase the utterance and remove tailing "."
  let u = context.recResult[0].utterance.toLowerCase().replace(/.$/g, "");
  let threshold = 0.96
  if (threshold < context.recResult[0].confidence) {
  if (u in grammar) {
    if (entity in grammar[u].entities) {
      return grammar[u].entities[entity];
    }
  }
} else {
  return false;
}
};

const getTop = (context: SDSContext)=>{
  const [top]=context.recResult;
  return {
    text: top?.utterance,
    confidence: top?.confidence || 0,
  };
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
            cond: (context)=> {
              const {confidence} = context.recResult[0];
              return confidence >= 0.75;
            },
            actions: assign({
              begining: (context)=>getEntity(context, "begining"),
            }),
          },
          {
            target: "#ask_confirm_meeting",
            cond: (context)=>{const {confidence}=context.recResult[0] && (context.nluResult.prediction.topIntent === "create a new meeting");
              return confidence <0.75;
            } 

          },
          /*{
            target: ".information",
            cond: (context)=> !!getEntity(context, "celeb") && (context.nluResult.prediction.topIntent === "Who is X"),
            actions: assign({celeb:
              context => {return context.recResult[0].utterance},
            }),
          },*/
          {
            target: "#celebrity",
            cond: (context)=> !!getEntity(context, "title"),
            actions: assign({
              title: (context)=> getEntity(context, "title"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Hello, Stas! What would you like to do today: create a new meeting or ask a celebrtiy question?"),
          on: {ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say("Sorry, I didn't quite get it. What was it?"),
          on: { ENDSPEECH: "ask"},
        },
        information: {
          id: "information",
          invoke: {
            src: (context, event) => kbRequest(context.celeb),
            onDone: [{
              target: 'who_it_is',
              cond: (context, event) => event.data.Abstract !== "",
              actions: assign({ information: (context, event) => event.data})
            },
            {
              target: 'no_name',
            },
          ],
          onError: {
            target: 'no_name',
            }
          }
        },
        celebrity: {
          id:"celebrity",
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
                target: ".nomatch",
              },
            ],
            TIMEOUT: ".prompt",
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
                  target: 'failure',
                },
              ],
                onError: {
                  target: 'failure',
                }
              }
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
            ask: {
              entry: send("LISTEN"),
            },
            nomatch: {
              entry: say(
                "Sorry, I don't know what it is. Tell me something I know."
              ),
              on: { ENDSPEECH: "ask" },
            },
          },
        },
    who_it_is: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `Here's what I found: ${context.information.Abstract}`,
        })),
      on: { ENDSPEECH: "#meeting" },
    },
    no_name: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `I could not find anything about ${context.celeb}.`
      })),
      on: {ENDSPEECH: "prompt"}
    },
  }, 
},
ask_confirm_meeting: {
  initial: "prompt",
  id: "ask_confirm_meeting",
  on: {
    RECOGNISED: [
      {
        target: "welcome",
        cond: (context)=> !!getEntity(context, "duration_y"),
        actions: assign({
          duration_y: (context)=> getEntity(context, "duration_y"),
        }),
      },
      {
        target: "greeting",
        cond: (context)=> !!getEntity(context, "duration_n"),
        actions: assign({
          duration_n: (context)=> getEntity(context, "duration_n"),
        }),
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_confirm_meeting"
  },
  states: {
    prompt: {
      entry: send((context)=>({
        type: "SPEAK",
        value: `Did you mean to say '${context.recResult[0].utterance.replace(/.$/g, "")}'?`
      })),
      on: {ENDSPEECH: "ask"},
    },
    ask: {
      entry: send("LISTEN"),
    },
    nomatch: {
      entry: say("Sorry, I didn't quite get it. Please say yes or no"),
      on: {ENDSPEECH: "#ask_confirm_meeting"}
    },
  },
},
ask_confirm_celebrity: {
  initial: "prompt",
  id: "ask_confirm_celebrity",
  on: {
    RECOGNISED: [
      {
        target: "#greeting.information",
        cond: (context)=> !!getEntity(context, "duration_y"),
        actions: assign({
          duration_y: (context)=> getEntity(context, "duration_y"),
        }),
      },
      {
        target: "greeting",
        cond: (context)=> !!getEntity(context, "duration_n"),
        actions: assign({
          duration_n: (context)=> getEntity(context, "duration_n"),
        }),
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: "#ask_confirm_celebrity"
  },
  states: {
    prompt: {
      entry: send((context)=>({
        type: "SPEAK",
        value: `Did you mean to say ${context.recResult[0].utterance}?`
      })),
      on: {ENDSPEECH: "ask"},
    },
    ask: {
      entry: send("LISTEN"),
    },
    nomatch: {
      entry: say("Sorry, I didn't quite get it. Please say yes or no"),
      on: {ENDSPEECH: "#ask_confirm_celebrity"}
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
            cond: (context) => !!getEntity(context, "duration_y"),
            actions: assign({
              duration_y: (context) => getEntity(context, "duration_y"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Do you want to meet them?"),
          on: {ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say('So yes?'),
          on: {ENDSPEECH: "ask"},
        },
      },
    },
    welcome: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "info",
            cond: (context)=>{
              const {confidence}=context.recResult[0];
              return confidence >= 0.80;
            },
            actions: assign({
              title: (context) => getEntity(context, "title"),
            }),
          },
          {
            target: "#ask_confirm_welcome",
            cond: (context)=>{
              const {confidence}=context.recResult[0];
              return confidence < 0.80;
            },
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Let's create a meeting. What is it about?"),
          on: { ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say(
            "Sorry, I don't know what it is. Tell me something I know."
          ),
          on: { ENDSPEECH: "ask" },
        },
      },
    }, 

welcome2: {
  id: "welcome2",
  initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "info",
            cond: (context)=>{
              const {confidence}=context.recResult[0];
              return confidence >= 0.50;
            },
            actions: assign({
              title: (context) => getEntity(context, "title"),
            }),
          },
          {
            target: "#ask_confirm_welcome",
            cond: (context)=>{
              const {confidence}=context.recResult[0];
              return confidence < 0.50;
            },
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say(" What is it about?"),
          on: { ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say(
            "Sorry, I don't know what it is. Tell me something I know."
          ),
          on: { ENDSPEECH: "ask" },
        },
        ask_confirm:{
          id: "ask_confirm_welcome12",
          entry: send((context)=>({
            type: "SPEAK",
            value: `So you want to create a meeting about ${context.title}, is that correct?`
          })),
          on: {ENDSPEECH: "ask"},
        },
      },
},

ask_confirm_welcome:{
  id: "ask_confirm_welcome",
  entry: send((context)=>({
    type: "SPEAK",
    value: `Are you sure you're saying '${context.recResult[0].utterance.replace(/.$/g, "")}' correctly? Say it again!`,
  })),
  on: {ENDSPEECH: "welcome2"},
},



/*ask_confirm_welcome1: {
      initial: "prompt",
      id: "ask_confirm_welcome1",
      on: {
        RECOGNISED: [
          {
            target: "whichday",
            cond: (context)=> !!getEntity(context, "duration_y"),
            actions: assign({
              duration_y: (context)=> getEntity(context, "duration_y"),
            }),
          },
          {
            target: "welcome",
            cond: (context)=> !!getEntity(context, "duration_n"),
            actions: assign({
              duration_n: (context)=> getEntity(context, "duration_n"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt"
      },
      states: {
        prompt: {
          entry: send((context)=>({
            type: "SPEAK",
            value: `So you want to create a meeting about ${context.title}, is that correct?`
          })),
          on: {ENDSPEECH: "ask"},
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say("Sorry, I didn't quite get it. Please say yes or no"),
          on: {ENDSPEECH: "#ask_confirm_welcome"}
        },
      },
    },*/




    info: {
      id: "info",
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, so ${context.title}, huh?`,
        })),
      on: { ENDSPEECH: "whichday" },
      },

      
    whichday: {
      id: "whichday",
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "Date",
              cond: (context)=>{
                const {confidence}=context.recResult[0];
                return confidence >=0.95;
              },
              actions: assign({
                day: (context) => getEntity(context, "day"),
              }),
            },
            {
              target: "ask_confirm_whichday",
              cond: (context)=> {
                const {confidence}=context.recResult[0];
                return confidence < 0.95;
              },
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: ".prompt",
        },
        states: {
          prompt: {
            entry: say("On which day is it?"),
            on: { ENDSPEECH: "ask" },
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say(
              "Are you sure you are saying it correcrly? Try again!"
            ),
            on: { ENDSPEECH: "ask" },
          },
        },
      }, 
ask_confirm_whichday:{
  id: "ask_confirm_whichday",
  entry: send((context)=> ({
    type: "SPEAK",
    value: `Are you sure you're saying '${context.recResult[0].utterance.replace(/.$/g, "")}' correctly? Say it again!`,
  })),
  on: {ENDSPEECH: "#whichday2"},
},

whichday2: {
  id: "whichday2",
    initial: "prompt",
    on: {
      RECOGNISED: [
        {
          target: "Date",
          cond: (context)=>{
            const {confidence}=context.recResult[0];
            return confidence >=0.70;
          },
          actions: assign({
            day: (context) => getEntity(context, "day"),
          }),
        },
        {
          target: "ask_confirm_whichday",
          cond: (context)=> {
            const {confidence}=context.recResult[0];
            return confidence < 0.70;
          },
        },
        {
          target: ".nomatch",
        },
      ],
      TIMEOUT: ".prompt",
    },
    states: {
      prompt: {
        entry: say("On which day is it?"),
        on: { ENDSPEECH: "ask" },
      },
      ask: {
        entry: send("LISTEN"),
      },
      nomatch: {
        entry: say(
          "Are you sure you are saying it correcrly? Try again!"
        ),
        on: { ENDSPEECH: "ask" },
      },
    },
  },

    Date: {
        entry: send((context) => ({
          type: "SPEAK",
          value: `OK, ${context.day} sounds like a good day!`,
          })),
        on: { ENDSPEECH: "askDuration" },
          },
    askDuration: {
      id:"duration",
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "meeting_created_whole_day",
              cond: (context)=>{
                const {confidence}=context.recResult[0];
                return confidence >=0.95;
              },
              actions: assign({
                duration_y: (context) => getEntity(context, "duration_y"),
              }),
            },
            {
              target: "#ask_confirm_date_yes",
              cond: (context)=>{
                const {confidence}=context.recResult[0];
                return confidence < 0.95;
              },
            },
            {
              target: "what_time",
              cond: (context)=>{
                const {confidence}=context.recResult[0];
                return confidence >= 0.95;
              },
              actions: assign({
                duration_n: (context) => getEntity(context, "duration_n"),
              }),
            },
            {
              target: "#ask_confirm_date_no",
              cond:  (context)=> {
                const {confidence}=context.recResult[0];
                return confidence < 0.95;
              },
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: ".prompt",
        },
        states: {
          prompt: {
            entry: say("Will it take the whole day?"),
            on: { ENDSPEECH: "ask" },
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say(
              "Sorry, come again?"
            ),
            on: { ENDSPEECH: "ask" },
          },
        },
      },
      ask_confirm_date_yes:{
        id: "ask_confirm_date_yes",
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "#meeting_created_whole_day",
              cond: (context)=> !!getEntity(context, "duration_y"),
              actions: assign({
                duration_y: (context)=>getEntity(context, "duration_y"),
              }),
              },
              {
                target: "#duration",
                cond: (context)=> !!getEntity(context, "durarion_n"),
                actions: assign({
                  duration_n: (context)=> getEntity(context, "duration_n"),
                }),
              },
              {
                target: ".nomatch",
              },
            ],
            TIMEOUT: "#ask_confirm_date_yes",
        },
        states: {
          prompt: {
            entry: send((context)=> ({
              type: "SPEAK",
              value: `Did you mean to say '${context.recResult[0].utterance.replace(/.$/g, "")}?`,
            })),
            on: {ENDSPEECH: "ask"},
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch:{
            entry: say("Sorry, I didn't quite get it. Please say yes or no."),
            on: {ENDSPEECH: "ask"},
          },
        },
      },

      ask_confirm_date_no:{
        id: "ask_confirm_date_no",
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "#whattime",
              cond: (context)=> !!getEntity(context, "duration_y"),
              actions: assign({
                duration_y: (context)=>getEntity(context, "duration_y"),
              }),
              },
              {
                target: "#duration",
                cond: (context)=> !!getEntity(context, "durarion_n"),
                actions: assign({
                  duration_n: (context)=> getEntity(context, "duration_n"),
                }),
              },
              {
                target: ".nomatch",
              },
            ],
            TIMEOUT: "#ask_confirm_date_no",
        },
        states: {
          prompt: {
            entry: send((context)=> ({
              type: "SPEAK",
              value: `Did you mean to say '${context.recResult[0].utterance.replace(/.$/g, "")}?`,
            })),
            on: {ENDSPEECH: "ask"},
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch:{
            entry: say("Sorry, I didn't quite get it. Please say yes or no."),
            on: {ENDSPEECH: "ask"},
          },
        },
      },
    meeting_created_whole_day: {
      id: "meeting_created_whole_day",
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "welcome",
            cond: (context) => {
              const {confidence}=context.recResult[0];
              return confidence >= 0.70;
            },
              actions: assign({
                duration_n: (context) => getEntity(context, "duration_n"),
              }),
            },
            {
              target: "#ask_meeting_whole_time",
              cond: (context) => {
                const {confidence}=context.recResult[0];
                return confidence < 0.70;
              },
            },
            {
              target: "endline",
              cond: (context) => {
                const {confidence}=context.recResult[0];
                return confidence >= 0.70;
              },
              actions: assign({
                duration_y: (context) => getEntity(context, "duration_y"),
              }),
            },
            {
              target: "#ask_meeting_whole_time",
              cond: (context) => {
                const {confidence}=context.recResult[0];
                return confidence < 0.70;
              },
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: ".prompt",
        },
        states: {
          prompt: {
            entry: send((context) => ({
              type: "SPEAK",
              value: `OK, do you want me to create a meeting "${context.title}" on ${context.day} for the whole day?`,
              })),
            on: { ENDSPEECH: "ask" },
              },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say(
              "So yes or no?"
            ),
            on: { ENDSPEECH: "ask" },
          },
        },
      },

  ask_confirm_whole_time:{
        id: "ask_meeting_whole_time",
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "#what_time_2",
              cond: (context)=> !!getEntity(context, "duration_y"),
          actions: assign({
            duration_y: (context)=> getEntity(context, "duration_y"),
          }),
            },
            {
              target: "#endline",
              cond: (context)=> !!getEntity(context, "duration_n"),
              actions: assign({
                duration_n: (context)=> getEntity(context, "duration_n"),
              }),
            },
            {
              target: ".nomatch",
            },
          ],
          TIMEOUT: "#ask_meeting_whole_time",
        },
        states: {
          prompt: {
            entry: send((context)=>({
              type: "SPEAK",
              value: `Did you mean to say '${context.recResult[0].utterance.replace(/.$/g, "")}'?`
            })),
            on: {ENDSPEECH: "ask"},
          },
          ask: {
            entry: send("LISTEN"),
          },
          nomatch: {
            entry: say("Sorry, I didn't quite get it. Please say yes or no"),
            on: {ENDSPEECH: "#ask_meeting_whole_time"}
          },
        },
      },
    what_time: {
      id: "whattime",
          initial: "prompt",
          on: {
            RECOGNISED: [
              {
                target: "meeting_specific_time",
                cond: (context) => {
                  const {confidence}=context.recResult[0];
                  return confidence >=0.70;
                },
                actions: assign({
                  time: (context) => getEntity(context, "time"),
                }),
              },
              {
                target: "#ask_confirm_time",
                cond: (context)=> {
                  const {confidence}=context.recResult[0];
                  return confidence < 0.70;
                },
              },
              {
                target: ".nomatch",
              },
            ],
            TIMEOUT: ".prompt",
          },
          states: {
            prompt: {
              entry: say("What time is your meeting?"),
              on: { ENDSPEECH: "ask" },
            },
            ask: {
              entry: send("LISTEN"),
            },
            nomatch: {
              entry: say(
                "Could you say that again?"
              ),
              on: { ENDSPEECH: "ask" },
            },
          },
        },
ask_confirm_time: {
  id: "ask_confirm_time",
  entry: send((context)=> ({
    type: "SPEAK",
    value: `I'm not sure that you're saying '${context.recResult[0].utterance.replace(/.$/g, "")}' correctly! Try saying it again?`,
  })),
  on: {ENDSPEECH: "#what_time_2"},
},
what_time_2:{
  id: "what_time_2",
  initial: "prompt",
  on: {
    RECOGNISED: [
      {
        target: "#meeting_1",
        cond: (context)=>{
          const {confidence}=context.recResult[0];
          return confidence >=0.70;
        },
        actions: assign({
          time: (context) => getEntity(context, "time"),
        }),
      },
      {
        target: "#ask_confirm_time",
        cond: (context)=> {
          const {confidence}=context.recResult[0];
          return confidence < 0.70;
        },
      },
      {
        target: ".nomatch",
      },
    ],
    TIMEOUT: ".prompt",
  },
  states: {
    prompt: {
      entry: say("What time is your meeting?"),
      on: {ENDSPEECH: "ask"},
    },
    ask: {
      entry: send("LISTEN"),
    },
    nomatch: {
      entry: say("Are you sure you're saying it correctly? Try again!"),
      on: {ENDSPEECH: "ask"},
    },
  },
},

      meeting_specific_time: {
        id: "meeting_1",
        initial: "prompt",
        on: {
          RECOGNISED: [
            {
              target: "welcome",
              cond: (context) => {
                const {confidence}=context.recResult[0];
                return confidence >= 0.70;
              },
                actions: assign({
                  duration_n: (context) => getEntity(context, "duration_n"),
                }),
              },
              {
                target: "#ask_confirm_specific_time",
                cond: (context)=>{
                  const {confidence}=context.recResult[0];
                  return confidence < 0.70;
                },
              },
                {
                  target: "endline",
                  cond: (context) => {
                    const {confidence}=context.recResult[0];
                  },
                  actions: assign({
                    duration_y: (context) => getEntity(context, "duration_y"),
                  }),
                },
                {
                  target: "#ask_confirm_specific_time",
                  cond: (context)=>{
                    const {confidence}=context.recResult[0];
                    return confidence < 0.70;
                  },
                },
                {
                  target: "endline",
                  cond: (context) => {
                    const {confidence}=context.recResult[0];
                    return confidence >=0.70;
                  },
                  actions: assign({
                    endline: (context) => getEntity(context, "endline"),
                  }),
                },
                {
                  target: "#ask_confirm_specific_time",
                  cond: (context)=>{
                    const {confidence}=context.recResult[0];
                    return confidence < 0.70;
                  },
                },
                {
                  target: ".nomatch",
                },
              ],
              TIMEOUT: ".prompt",
            },
            states: {
              prompt: {
                entry: send((context) => ({
                  type: "SPEAK",
                  value: `OK, do you want me to create a meeting titled ${context.title} on ${context.day} at ${context.time}?`,
                  })),
                on: { ENDSPEECH: "ask" },
                  },
              ask: {
                entry: send("LISTEN"),
              },
              nomatch: {
                entry: say(
                  "So yes or no?"
                ),
                on: { ENDSPEECH: "ask" },
              },
            },
          },
    ask_confirm_specific_time:{
      id: "ask_confirm_specific_time",
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "#endline",
            cond: (context)=> !!getEntity(context, "duration_y"),
        actions: assign({
          duration_y: (context)=> getEntity(context, "duration_y"),
        }),
          },
          {
            target: "#what_time_2",
            cond: (context)=> !!getEntity(context, "duration_n"),
            actions: assign({
              duration_n: (context)=> getEntity(context, "duration_n"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: "#ask_confirm_specific_time",
      },
      states: {
        prompt: {
          entry: send((context)=>({
            type: "SPEAK",
            value: `Did you mean to say '${context.recResult[0].utterance.replace(/.$/g, "")}'?`
          })),
          on: {ENDSPEECH: "ask"},
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say("Sorry, I didn't quite get it. Please say yes or no"),
          on: {ENDSPEECH: "#ask_confirm_specific_time"}
        },
      },
    },
    endline: {
      id: "endline",
          entry: send((context) => ({
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
