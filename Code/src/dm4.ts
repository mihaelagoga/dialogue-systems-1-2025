import { assign, createActor, setup } from "xstate";
import { Settings, speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import {KEY,NLU_KEY } from "./azure";
import { DMContext, DMEvents } from "./types";

const inspector = createBrowserInspector();


const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://language-resource-23456.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2024-11-15-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY /** reference to your Azure CLU key */,
  deploymentName: "appointment" /** your Azure CLU deployment */,
  projectName: "appointment" /** your Azure CLU project name */,
};

const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials,
  azureCredentials: azureCredentials,
  azureRegion: "northeurope",
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};


interface GrammarEntry {
  person?: string;
  day?: string;
  time?: string;
  whole?: string;
  decision?: string;
}

const grammar: { [index: string]: GrammarEntry } = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  victoria: { person: "Victoria Daniilidou" },
  mela: { person: "Mihaela Goga" },
  andrei: { person: "Andrei Pely" },
  klaus: { person: "Klaus Iohannis" },
  luca: { person: "Luca Toni" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  saturday: { day: "Saturday" },
  sunday: { day: "Sunday" },
  "8 am": { time: "08:00 AM" },
  "9 am": { time: "09:00 AM" },
  "10 am": { time: "10:00 AM" },
  "11 am": { time: "11:00 AM" },
  "12 pm": { time: "12:00 PM" },
  "1 pm": { time: "01:00 PM" },
  "2 pm": { time: "02:00 PM" },
  "3 pm": { time: "03:00 PM" },
  "4 pm": { time: "04:00 PM" },
  "5 pm": { time: "05:00 PM" },
  "6 pm": { time: "06:00 PM" },
  "7 pm": { time: "07:00 PM" },
  "8 pm": { time: "08:00 PM" },
  "9 pm": { time: "09:00 PM" },
  "10 pm": { time: "10:00 PM"},
  "11 pm": { time: "11:00 PM"},
  noon: { time: "12:00 PM" },
  midday: { time: "12:00 PM" },
  midnight: { time: "12:00 AM" },
  "whole day": { whole: "yes" },
  "all day": { whole: "yes" },
  "full day": { whole: "yes" },
  yes: { decision: "yes" },
  yeah: { decision: "yes" },
  "of course": { decision: "yes" },
  "sure": { decision: "yes" },
  "definitely": { decision: "yes" },
  "absolutely": { decision: "yes" },
  no: { decision: "no" },
  neh: { decision: "no" },
  "no way": { decision: "no" },
  "nope": { decision: "no" },
  "not really": { decision: "no" },
};

const famousPerson: { [index: string]: string } = {

  "jerry springer": "Jerry Springer is an American TV host and former lawyer and actor. He is most famous for the controversial talk show Jerry Springer hosted between 1991 and 2018.",
  "william gibson": "William Gibson is an American-Canadian science-fiction writer and essayist.He is best known for being a pioneer for the science fiction subgenre cyberpunk.He invented the term 'cyberspace'." ,
  "ray bradbury": "Ray Bradbury was an American author and screenwriter and is known for a variety of genres such as: fantasy, science fiction, horror, and mystery fiction. His most popular book is 'Fahrenheit 451'." ,
  "terry pratchett": "Terry Pratchett was an English author,humorist and satirist.He wrote around 40 fantasy books.Some of his best books are 'Night Watch' and 'Good Omens' . " ,
  "dr.seuss": "Dr.Seuss was an American children's author and cartoonist who wrote more than 60 books with this nickname.His real name is actually Theodor Suess Geisel. " ,
  "robert smith": "Robert Smith is an English singer and the co-founder, lead vocalist, songwriter, guitarist of the post punck rock band 'The Cure'. The band was formed in 1976 and it has been a hit ever since." ,
  "jim morrison": "Jim Morrison, or rather James Douglas Morrison was an American singer and poet.He is known for being the lyricsit and lead vocalist of the rock band 'The Doors'." ,
  "meryl streep": "Meryl Streep is an American actress with a variety of nominations and awards.One of her most iconic movie is called 'The devil wears Prada'." ,
  "malcon x": "Malcom x  was an African-American revolutioary who fought bravely for Muslims and human rights. He was assasinated by Thomas Hagan in 1965." ,
  "morgan freeman": "Morgan Freeman is an American actor but also dabbled with being a producer and narrator. He won a variety of awards. One of his most famous movie is Street Smart." ,
 };

function isInGrammar(utterance: string) {
  return utterance.toLowerCase() in grammar;
}


function isNo(utterance: string): boolean {
  return getDecision(utterance) === "no";
}

function isYes(utterance: string): boolean {
  return getDecision(utterance) === "yes";
}

function getPerson(utterance: string) {
  return grammar[utterance.toLowerCase()]?.person || null;
}

function getDay(utterance: string) {
  return grammar[utterance.toLowerCase()]?.day || null;
}

function getTime(utterance: string) {
  return grammar[utterance.toLowerCase()]?.time || null;
}

function getDecision(utterance: string) {
  return grammar[utterance.toLowerCase()]?.decision || null;
}


function personIsInGrammar(utterance: string): boolean {
  return getPerson(utterance) !== null;
}

function dayIsInGrammar(utterance: string): boolean {
  return getDay(utterance) !== null;
}

function timeIsInGrammar(utterance: string): boolean {
  return getTime(utterance) !== null;
}


function getEntityValue(nluResult: any, entityName: string): string | null {
  if (!nluResult || !nluResult.entities) return null;

  const entity = nluResult.entities.find((e: any) => e.category === entityName);
  return entity ? entity.text : null;
}

const dmMachine = setup({
  types: {
    context: {} as DMContext,
    events: {} as DMEvents,
  },
  actions: {
    /** define your actions here */
    "spst.speak": ({ context }, params: { utterance: string }) => {
      console.log("spst.speak action CALLED:", params.utterance);
      context.spstRef.send({
        type: "SPEAK",
        value: {
          utterance: params.utterance,
        },
      });
    },
    "spst.listen": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
      }),


    "spst.listen.nlu": ({ context }) =>
      context.spstRef.send({
        type: "LISTEN",
        value: { nlu: true },
      }),

    "clearLastResult": assign({ lastResult: null }),
    "clearMeetingDetails": assign({
      meetingPartnerName: null,
      meetingDay: null,
      meetingTime: null,
      isWholeDay: false,
      confirmationDecision: null,
    }),

     "assignNluResult": assign(({ event }) => {
        if ('nluValue' in event) {
         return { nluResult: event.nluValue };
        }
       return {};
    }),

    "assignLastResult": assign(({ event }) => {
      if ('value' in event) {
        return { lastResult: event.value };
      }
      return {};
    }),

    "assignMeetingPartnerName": assign(({ context }) => {

      if (context.nluResult) {
        const personEntity = getEntityValue(context.nluResult, "meetingPartnerName");
        if (personEntity) return { meetingPartnerName: personEntity };
      }


      const utterance = context.lastResult?.[0]?.utterance;
      return utterance ? { meetingPartnerName: getPerson(utterance) || utterance } : {};
    }),


    "assignMeetingDay": assign(({ context }) => {
      if (context.nluResult) {
        const dayEntity = getEntityValue(context.nluResult, "meetingDay");
        if (dayEntity) return { meetingDay: dayEntity };
      }

      const utterance = context.lastResult?.[0]?.utterance;
      return utterance ? { meetingDay: getDay(utterance) || utterance } : {};
    }),

    "assignMeetingTime": assign(({ context }) => {
      if (context.nluResult) {
        const timeEntity = getEntityValue(context.nluResult, "meetingTime");
        if (timeEntity) return { meetingTime: timeEntity };
      }

      const utterance = context.lastResult?.[0]?.utterance;
      return utterance ? { meetingTime: getTime(utterance) || utterance } : {};
    }),

    "assignIsWholeDay": assign(({ context }) => {
      if (context.nluResult) {
        const decisionEntity = getEntityValue(context.nluResult, "confirmationDecision");
        if (decisionEntity && decisionEntity.toLowerCase() === "yes") {
          return { isWholeDay: true };
        }
      }

      if (context.lastResult && context.lastResult.length > 0) {
        const utterance = context.lastResult[0].utterance;
        return { isWholeDay: isYes(utterance) };
      }
      return {};
    }),

    "assignConfirmationDecision": assign(({ context }) => {
      if (context.nluResult) {
        const decisionEntity = getEntityValue(context.nluResult, "confirmationDecision");
        if (decisionEntity) return { confirmationDecision: decisionEntity.toLowerCase() };
      }

      if (context.lastResult && context.lastResult.length > 0) {
        const utterance = context.lastResult[0].utterance;
        return { confirmationDecision: getDecision(utterance) };
      }
      return {};
    }),
  },

  guards: {
    hasLastResult: ({ context }) =>
      context.lastResult !== null && context.lastResult.length > 0,

    isInGrammar: ({ context }) =>
      context.lastResult !== null &&
      context.lastResult.length > 0 &&
      isInGrammar(context.lastResult[0].utterance),


     // Add a guard for checking intent
     isCreateMeetingIntent: ({ context }) =>
      context.nluResult && context.nluResult.topIntent === "create a meeting",

    isWhoIsXIntent: ({ context }) =>
      context.nluResult && context.nluResult.topIntent === "who is X",


    personIsInGrammar: ({ context }) => {

      if (context.nluResult) {
        const personEntity = getEntityValue(context.nluResult, "meetingPartnerName");
        if (personEntity) return true;
      }

      // Fall back to grammar
      return context.lastResult !== null &&
        context.lastResult.length > 0 &&
        getPerson(context.lastResult[0].utterance) !== null;
    },

    // Update other guards similarly...
    dayIsInGrammar: ({ context }) => {
      if (context.nluResult) {
        const dayEntity = getEntityValue(context.nluResult, "meetingDay");
        if (dayEntity) return true;
      }

      return context.lastResult !== null &&
        context.lastResult.length > 0 &&
        getDay(context.lastResult[0].utterance) !== null;
    },

    timeIsInGrammar: ({ context }) => {
      if (context.nluResult) {
        const timeEntity = getEntityValue(context.nluResult, "meetingTime");
        if (timeEntity) return true;
      }

      return context.lastResult !== null &&
        context.lastResult.length > 0 &&
        getTime(context.lastResult[0].utterance) !== null;
    },

    decisionIsInGrammar: ({ context }) => {
      if (context.nluResult) {
        const decisionEntity = getEntityValue(context.nluResult, "confirmationDecision");
        if (decisionEntity) return true;
      }

      return context.lastResult !== null &&
        context.lastResult.length > 0 &&
        getDecision(context.lastResult[0].utterance) === null;
    },

    confirmationIsYes: ({ context }) => {
      if (context.nluResult) {
        const decisionEntity = getEntityValue(context.nluResult, "confirmationDecision");
        if (decisionEntity && decisionEntity.toLowerCase() === "yes") return true;
      }

      return context.confirmationDecision === "yes";
    },

    confirmationIsNo: ({ context }) => {
      if (context.nluResult) {
        const decisionEntity = getEntityValue(context.nluResult, "confirmationDecision");
        if (decisionEntity && decisionEntity.toLowerCase() === "no") return true;
      }

      return context.confirmationDecision === "no";
    },
  }


}).createMachine({
  context: ({ spawn }) : DMContext => ({
    spstRef: spawn(speechstate, { input: settings }),
    lastResult: null,
    nluResult: null,
    meetingPartnerName: null,
    meetingDay: null,
    meetingTime: null,
    isWholeDay: null,
    confirmationDecision: null
  }),

  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: ({ context }) => context.spstRef.send({ type: "PREPARE" }),
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: { CLICK: "Greeting" },
    },
    Greeting: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "Hello! What can I help you with today?" } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
        Listen: {
          entry: "spst.listen.nlu",
          on: {
            RECOGNISED: {
              actions: ["assignLastResult", "assignNluResult"]
            },
            ASR_NOINPUT: { actions: "clearLastResult" },
          },
        },
        NoInput: {
          entry: { type: "spst.speak", params: { utterance: "I didn't catch that, please try again. Are you trying to schedule a meeting or ask about a famous celebrity?" } },
          on: { SPEAK_COMPLETE: "Listen" },
        },
      },
      on: {
        LISTEN_COMPLETE: [
          {
            target: "CreateMeetingIntentHandler",
            guard: "isCreateMeetingIntent",
          },
          {
            target: "WhoisX",
            guard: "isWhoIsXIntent",
          },
          {
            target: ".NoInput",
          },
        ],
      },
    },
    CreateMeetingIntentHandler: {
      entry: {
        type: "spst.speak",
        params: { utterance: "Okay, let's schedule a meeting. Who are you meeting with?" }
      },
      on: { SPEAK_COMPLETE: "AskWho" },
    },

    WhoisX: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => {

              const personEntity = context.nluResult ? getEntityValue(context.nluResult, "famousPerson") : null;
              const personName = personEntity || "that person";

              return { utterance: `Let me tell you about ${personName}.` };
            }
          },
          on: { SPEAK_COMPLETE: "ProvideInfo" },
        },
        ProvideInfo: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => {

              const personEntity = context.nluResult ? getEntityValue(context.nluResult, "famousPerson") : null;


              if (personEntity) {
                if (famousPerson[personEntity.toLowerCase()]) {
                  return { utterance: famousPerson[personEntity.toLowerCase()] };
                }
                else {
                  return { utterance: `I'm sorry, I don't have specific information about ${personEntity}.` };
                }
              } else {
                return { utterance: "I'm not sure who you're asking about. Could you please specify a name?" };
              }
            }
          },
          on: { SPEAK_COMPLETE: "Done" },
        },
        Done: {
          entry: {
            type: "spst.speak",
            params: { utterance: "Is there anything else you'd like to know?" }
          },
          on: { SPEAK_COMPLETE: "#DM.Greeting" },
        },
      },
    },

    AskWho: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "Nice to meet you.Who are you meeting with?" } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen", value: { nlu: true } },
          on: {
            RECOGNISED: { actions: ["assignLastResult", "assignMeetingPartnerName"] },
            ASR_NOINPUT: {
              target: "NoInput",
              actions: "clearLastResult"
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't hear anything. Who are you meeting with?" }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NotInGrammar: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I don't recognize ${context.lastResult![0].utterance} in my database. Please choose someone else.`
            })
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Confirmation: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I've noted down ${context.meetingPartnerName}.`
            })
          },
          on: { SPEAK_COMPLETE: "#DM.AskDay" },
        },
      },
       on: {
        LISTEN_COMPLETE: [
          {
            target: ".NotInGrammar",
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              !personIsInGrammar(context.lastResult[0].utterance)
          },
          {
            target: ".Confirmation",
            guard: "personIsInGrammar"
          },
          {
            target: ".NoInput"
          }
        ],
        CHILD_DONE: "AskDay"
      },
    },
    AskDay: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "On which day is your meeting?" } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen", value: { nlu: true } }, // NLU ACTIVATED
          on: {
            RECOGNISED: { actions: ["assignLastResult", "assignMeetingDay"] },
            ASR_NOINPUT: {
              target: "NoInput",
              actions: "clearLastResult"
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't hear anything. On which day is your meeting?" }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NotInGrammar: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I don't recognize ${context.lastResult![0].utterance} as a valid day. Please choose a day of the week.`
            })
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Confirmation: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `You are meeting with ${context.meetingPartnerName} on ${context.meetingDay}.`
            })
          },
          on: { SPEAK_COMPLETE: "#DM.AskWholeDay" },
        },

      },
      on: {
        LISTEN_COMPLETE: [
          {
            target: ".NotInGrammar",
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              !dayIsInGrammar(context.lastResult[0].utterance)
          },
          {
            target: ".Confirmation",
            guard: "dayIsInGrammar"
          },
          {
            target: ".NoInput"
          }
        ],
        CHILD_DONE: "AskWholeDay"
      },
    },
    AskWholeDay: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "Will it take the whole day?" } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen", value: { nlu: true } }, // NLU ACTIVATED
          on: {
            RECOGNISED: { actions: ["assignLastResult", "assignIsWholeDay", "assignConfirmationDecision"] },
            ASR_NOINPUT: {
              target: "NoInput",
              actions: "clearLastResult"
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't hear it. Will it take the whole day?" }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NotInGrammar: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't understand. Please answer yes or no." }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        }
      },
      on: {
        LISTEN_COMPLETE: [
          {
            target: ".NotInGrammar",
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              getDecision(context.lastResult[0].utterance) === null
          },
          {
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              isYes(context.lastResult[0].utterance),
            target: "ConfirmAppointmentWholeDay"
          },
          {
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              isNo(context.lastResult[0].utterance),
            target: "AskTime"
          },
          {
            target: ".NoInput"
          }
        ]
      },
    },
    AskTime: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: { type: "spst.speak", params: { utterance: "What time is your meeting?" } },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen", value: { nlu: true } }, // NLU ACTIVATED
          on: {
            RECOGNISED: { actions: ["assignLastResult", "assignMeetingTime"] },
            ASR_NOINPUT: {
              target: "NoInput",
              actions: "clearLastResult"
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't hear anything. What time is your meeting?" }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NotInGrammar: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I don't recognize ${context.lastResult![0].utterance} as a valid time. Please choose a time like 3 pm or 11 am.`
            })
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Confirmation: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `You said ${context.meetingTime}.`
            })
          },
          on: { SPEAK_COMPLETE: "#DM.ConfirmAppointment" },
        }
      },
      on: {
        LISTEN_COMPLETE: [
          {
            target: ".NotInGrammar",
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              !timeIsInGrammar(context.lastResult[0].utterance)
          },
          {
            target: ".Confirmation",
            guard: "timeIsInGrammar"
          },
          {
            target: ".NoInput"
          }
        ],
        CHILD_DONE: "ConfirmAppointment"
      },
    },
    ConfirmAppointment: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `Do you want me to create an appointment with ${context.meetingPartnerName} on ${context.meetingDay} at ${context.meetingTime}?`
            })
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen", value: { nlu: true } }, // NLU ACTIVATED
          on: {
            RECOGNISED: { actions: ["assignLastResult", "assignConfirmationDecision"] },
            ASR_NOINPUT: {
              target: "NoInput",
              actions: "clearLastResult"
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `I didn't hear anything. Do you want me to create an appointment with ${context.meetingPartnerName} on ${context.meetingDay} at ${context.meetingTime}?`
            })
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NotInGrammar: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't understand. Please answer yes or no." }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        }
      },
      on: {
        LISTEN_COMPLETE: [
          {
            target: ".NotInGrammar",
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              getDecision(context.lastResult[0].utterance) === null
          },
          {
            guard: "confirmationIsYes",
            target: "AppointmentCreated"
          },
          {
            guard: "confirmationIsNo",
            target: "AppointmentCanceled"
          },
          {
            target: ".NoInput"
          }
        ]
      },
    },
    ConfirmAppointmentWholeDay: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: {
            type: "spst.speak",
            params: ({ context }) => ({
              utterance: `Do you want me to create an appointment with ${context.meetingPartnerName} on ${context.meetingDay} for the whole day?`
            })
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: { type: "spst.listen", value: { nlu: true } }, // NLU ACTIVATED
          on: {
            RECOGNISED: { actions: ["assignLastResult", "assignConfirmationDecision"] },
            ASR_NOINPUT: {
              target: "NoInput",
              actions: "clearLastResult"
            },
          },
        },
        NoInput: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't hear anything. Do you want me to create an appointment with ${context.meetingPartnerName} on ${context.meetingDay} for the whole day?" }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        },
        NotInGrammar: {
          entry: {
            type: "spst.speak",
            params: { utterance: "I didn't understand. Please answer yes or no." }
          },
          on: { SPEAK_COMPLETE: "Ask" },
        }
      },
      on: {
        LISTEN_COMPLETE: [
          {
            target: ".NotInGrammar",
            guard: ({ context }) =>
              context.lastResult !== null &&
              context.lastResult.length > 0 &&
              getDecision(context.lastResult[0].utterance) === null
          },
          {
            guard: "confirmationIsYes",
            target: "AppointmentCreated"
          },
          {
            guard: "confirmationIsNo",
            target: "AppointmentCanceled"
          },
          {
            target: ".NoInput"
          }
        ]
      },
    },
    AppointmentCreated: {
      entry: [
        {
          type: "spst.speak",
          params: ({ context }) => {
            const timeInfo = context.isWholeDay
              ? "for the whole day"
              : `at ${context.meetingTime}`;

            return { utterance: `Your appointment with ${context.meetingPartnerName} on ${context.meetingDay} ${timeInfo} has been created! Goodbye and have a wonderful day` };
          }
        },
      ],
      on: { SPEAK_COMPLETE: "Done" },
    },
    AppointmentCanceled: {
      entry: [
        { type: "spst.speak", params: { utterance: "I can not create the appointment. Let's start again." } },
        "clearMeetingDetails"
      ],
      on: { SPEAK_COMPLETE: "Greeting" },
    },
    Done: {
      on: {
        CLICK: "Greeting",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.group("State update");
  console.log("State value:", state.value);
  console.log("State context:", state.context);
  console.groupEnd();
});

export function setupButton(element: HTMLButtonElement) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.subscribe((snapshot) => {
    const meta: { view?: string } = Object.values(
      snapshot.context.spstRef.getSnapshot().getMeta()
    )[0] || {
      view: undefined,
    };
    element.innerHTML = `${meta.view}`;
  });
}