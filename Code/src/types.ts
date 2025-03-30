import { Hypothesis, SpeechStateExternalEvent } from "speechstate";
import { AnyActorRef } from "xstate";


export interface DMContext {
  spstRef: AnyActorRef;
  lastResult: Hypothesis[] | null;
  
  meetingPartnerName: string | null |undefined;
  meetingDay: string | null | undefined;      
  meetingTime: string | null | undefined;      
  isWholeDay: boolean | null ;    
  famousPersonName: string|  null | undefined;
 
  nluResult:any

}

export type DMEvents = SpeechStateExternalEvent | { type: "CLICK" };
                                             