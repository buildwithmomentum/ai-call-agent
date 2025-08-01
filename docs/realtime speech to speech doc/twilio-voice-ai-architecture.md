# Twilio Voice AI Architecture Diagrams

This document provides visual diagrams of the Twilio Voice AI system architecture and multi-call handling.

## System Architecture Overview

```
                                      +-------------------+
                                      |                   |
                           +--------->+ OpenAI Realtime   |
                           |          | Transcription API |
                           |          |                   |
                           |          +-------------------+
                           |
                           |
+-------------+     +------+--------+     +---------------+
|             |     |               |     |               |
| Caller      +---->+ Our Backend   +---->+ Grok API      |
| (Twilio)    |     | NestJS Server |     | (LLM)         |
|             |     |               |     |               |
+-------------+     +------+--------+     +---------------+
                           |
                           |
                           |          +-------------------+
                           |          |                   |
                           +--------->+ ElevenLabs API    |
                                      | (Text-to-Speech)  |
                                      |                   |
                                      +-------------------+
```

## Multi-Call Architecture

```
Call 1                 Backend (NestJS Server)              External APIs
+--------+     +------------------------------------+     +-----------------+
|        |     | +------------------------------+   |     | +-------------+ |
| Twilio +---->+ |Call 1 Connection:            |   +---->+ | OpenAI API  | |
| Client |     | | - Client ID: client_1_xyz    |   |     | +-------------+ |
|        |     | | - Twilio WebSocket           |   |     |                 |
+--------+     | | - Call Session Object        |   |     | +-------------+ |
               | | - Conversation History       +---------->+ | Grok API    | |
               | | - Voice Agent Config         |   |     | +-------------+ |
               | +------------------------------+   |     |                 |
               |                                    |     | +-------------+ |
               |                                    +---->+ | ElevenLabs  | |
               |                                    |     | +-------------+ |
               +------------------------------------+     +-----------------+
                                ⋮
Call N                 Backend (NestJS Server)              External APIs
+--------+     +------------------------------------+     +-----------------+
|        |     | +------------------------------+   |     | +-------------+ |
| Twilio +---->+ |Call N Connection:            |   +---->+ | OpenAI API  | |
| Client |     | | - Client ID: client_N_xyz    |   |     | +-------------+ |
|        |     | | - Twilio WebSocket           |   |     |                 |
+--------+     | | - Call Session Object        |   |     | +-------------+ |
               | | - Conversation History       +---------->+ | Grok API    | |
               | | - Voice Agent Config         |   |     | +-------------+ |
               | +------------------------------+   |     |                 |
               |                                    |     | +-------------+ |
               |                                    +---->+ | ElevenLabs  | |
               |                                    |     | +-------------+ |
               +------------------------------------+     +-----------------+
```

## Connection Management

```
+-------------------------------+
| TwilioService                 |
|                               |
| +--------------------------+  |
| | clientConnections Map    |  |
| |                          |  |
| | client_1_xyz -> Conn 1 --+--+----+
| | client_2_xyz -> Conn 2 --+--+----+----+
| | client_3_xyz -> Conn 3 --+--+----+----+----+
| |        ...               |  |    |    |    |
| +--------------------------+  |    |    |    |
|                               |    |    |    |
+-------------------------------+    |    |    |
                                     |    |    |
+-------------------------------+    |    |    |
| Connection 1                  |<---+    |    |
|                               |         |    |
| - OpenAI WebSocket            |         |    |
| - ElevenLabs WebSocket        |         |    |
| - State                       |         |    |
| - Call SID: call_1_xyz        |         |    |
| - Last Activity               |         |    |
+-------------------------------+         |    |
                                          |    |
+-------------------------------+         |    |
| Connection 2                  |<--------+    |
|                               |              |
| - OpenAI WebSocket            |              |
| - ElevenLabs WebSocket        |              |
| - State                       |              |
| - Call SID: call_2_xyz        |              |
| - Last Activity               |              |
+-------------------------------+              |
                                               |
+-------------------------------+              |
| Connection 3                  |<-------------+
|                               |
| - OpenAI WebSocket            |
| - ElevenLabs WebSocket        |
| - State                       |
| - Call SID: call_3_xyz        |
| - Last Activity               |
+-------------------------------+
```

## Call Session Management

```
+-------------------------------+
| CallSessionService            |
|                               |
| +--------------------------+  |
| | activeSessions Map       |  |
| |                          |  |
| | call_1_xyz -> Session 1  |  |
| | call_2_xyz -> Session 2  |  |
| | call_3_xyz -> Session 3  |  |
| |        ...               |  |
| +--------------------------+  |
|                               |
| +--------------------------+  |
| | streamToCallSid Map      |  |
| |                          |  |
| | stream_1 -> call_1_xyz   |  |
| | stream_2 -> call_2_xyz   |  |
| | stream_3 -> call_3_xyz   |  |
| |        ...               |  |
| +--------------------------+  |
|                               |
+-------------------------------+
```

## WebSocket Connection Flow

```
+--------+             +----------------+              +---------------+
| Twilio |             | Our Server     |              | External APIs |
+--------+             +----------------+              +---------------+
    |                         |                               |
    | Connect WebSocket       |                               |
    +------------------------>|                               |
    |                         |                               |
    |                         | Connect to OpenAI            |
    |                         +------------------------------>|
    |                         |                               |
    |                         | Connect to ElevenLabs         |
    |                         +------------------------------>|
    |                         |                               |
    | Send start event        |                               |
    +------------------------>|                               |
    |                         |                               |
    | Send media chunks       |                               |
    +------------------------>|                               |
    |                         | Forward audio to OpenAI       |
    |                         +------------------------------>|
    |                         |                               |
    |                         | Receive transcription         |
    |                         |<------------------------------+
    |                         |                               |
    |                         | Send text to Grok             |
    |                         +------------------------------>|
    |                         |                               |
    |                         | Receive LLM response          |
    |                         |<------------------------------+
    |                         |                               |
    |                         | Send text chunks to ElevenLabs|
    |                         +------------------------------>|
    |                         |                               |
    |                         | Receive audio chunks          |
    |                         |<------------------------------+
    |                         |                               |
    | Receive audio response  |                               |
    |<------------------------+                               |
    |                         |                               |
```

## Resource Monitoring and Cleanup

```
+------------------+        +------------------+
|                  |        |                  |
| Active Calls     |        | Connection       |
|                  |        | Monitor          |
+------------------+        +------------------+
       |                           |
       | Check every               | Run every 60s
       | 60 seconds                |
       v                           v
+--------------------------------------------------+
|                                                  |
| For each connection:                             |
|                                                  |
| If lastActivity > 5 minutes ago:                 |
|    1. Close WebSockets                           |
|    2. Clear intervals                            |
|    3. End call session                           |
|    4. Remove from clientConnections map          |
|                                                  |
+--------------------------------------------------+
        |
        v
+------------------+
|                  |
| Resources        |
| Released         |
|                  |
+------------------+
```

These diagrams provide a visual representation of the multi-call architecture implemented in our Twilio Voice AI system. 