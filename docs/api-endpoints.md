# Testing the Application Endpoints with Postman

## Table of Contents

-   [Introduction](#introduction)
-   [Accessing Swagger UI](#accessing-swagger-ui)
-   [Auth Endpoints](#auth-endpoints)
    -   [1. Register a New User](#1-register-a-new-user)
    -   [2. Login User](#2-login-user)
    -   [3. Get Current User Token](#3-get-current-user-token)
    -   [4. Get Current User Information](#4-get-current-user-information)
    -   [5. Refresh Access Token](#5-refresh-access-token)
-   [Customer Endpoints](#customer-endpoints)
    -   [5. Get Logged-In Customer Data](#5-get-logged-in-customer-data)
    -   [6. Get Specific Customer Data](#6-get-specific-customer-data)
    -   [7. Delete the Logged-In User](#7-delete-the-logged-in-user)
    -   [8. Update Customer Credits by UUID](#8-update-customer-credits-by-uuid)
    -   [9. Get Customer Data by Email](#9-get-customer-data-by-email)
    -   [10. Update Customer Profile](#10-update-customer-profile)
-   [Voice Agent Endpoints](#voice-agent-endpoints)
    -   [11. Create a Voice Agent](#11-create-a-voice-agent)
    -   [12. Update a Voice Agent](#12-update-a-voice-agent)
    -   [13. Retrieve All Voice Agents](#13-retrieve-all-voice-agents)
    -   [14. Retrieve a Single Voice Agent](#14-retrieve-a-single-voice-agent)
    -   [15. Delete a Voice Agent](#15-delete-a-voice-agent)
    -   [16. Update Last Trained Timestamp](#16-update-last-trained-timestamp)
    -   [17. Update Takeover Settings](#17-update-takeover-settings)
    -   [18. Update Private Settings](#18-update-private-settings)
    -   [19. Get Voice Agent Permissions](#19-get-voice-agent-permissions)
    -   [20. Fetch Detailed Voice Agent Data](#20-fetch-detailed-voice-agent-data)
    -   [21. Update Twilio Phone Number](#21-update-twilio-phone-number)
    -   [22. [Admin Only] Update System Messages for All Voice Agents](#22-admin-only-update-system-messages-for-all-voice-agents)
-   [Business Endpoints](#business-endpoints)
    -   [23. Create a Business](#23-create-a-business)
    -   [24. Update a Business](#24-update-a-business)
    -   [25. Delete a Business](#25-delete-a-business)
    -   [26. Get Operating Schedule by Voice Agent ID](#26-get-operating-schedule-by-voice-agent-id)
    -   [27. Update Specific Days in Operating Schedule](#27-update-specific-days-in-operating-schedule)
    -   [28. Get Business Details by Voice Agent ID](#28-get-business-details-by-voice-agent-id)
-   [Training Endpoints](#training-endpoints)
    -   [29. Website Training](#29-website-training)
    -   [30. Text Training](#30-text-training)
    -   [31. File Upload Training](#31-file-upload-training)
    -   [32. Audio Training](#32-audio-training)
    -   [Common Error Responses](#common-error-responses)
-   [Scraping Endpoints](#scraping-endpoints)
    -   [33. Scrape Multiple Websites (Scrapes specified websites and returns their preview data)](#33-scrape-multiple-websites)
    -   [34. Scan URL Progress (SSE) (Streams real-time progress for URL scanning)](#34-scan-url-progress-sse)
    -   [35. Fetch URL](#35-fetch-url)
    -   [Scraping Flow & Usage](#scraping-flow--usage)
-   [Context Endpoint](#context-endpoint)
    -   [36. Context Endpoint](#36-context-endpoint)
-   [Agent Configuration](#agent-configuration)
    -   [37. Voice Agent and Business Configuration](#voice-agent-and-business-configuration)
-   [Functions Endpoints](#functions-endpoints)
    -   [38. Create a Function](#38-create-a-function)
    -   [39. Get All Functions](#39-get-all-functions)
    -   [40. Get Function by ID](#40-get-function-by-id)
    -   [41. Update a Function](#41-update-a-function)
    -   [42. Delete a Function](#42-delete-a-function)
    -   [43. Upload Files](#43-upload-files)
    -   [44. Update Function Status](#44-update-function-status)
    -   [45. Get Functions by Assistant ID](#45-get-functions-by-assistant-id)
    -   [46. [Admin Only] Update Default Functions for All Voice Agents](#46-admin-only-update-default-functions-for-all-voice-agents)
 
-   [Tools Endpoints](#tools-endpoints)
    -   [Get Tools by Assistant ID](#get-tools-by-assistant-id)
    -   [Get Function Data by Assistant ID](#get-function-data-by-assistant-id)
-   [Realtime Endpoints](#realtime-endpoints)
    -   [Create Realtime Session](#create-realtime-session)
-   [Appointments Endpoints](#appointments-endpoints)
    -   [Create a New Appointment](#create-a-new-appointment)
    -   [Get Appointments by Phone Number](#get-appointments-by-phone-number)
    -   [Get Booked Slots](#get-booked-slots)
    -   [Update Appointment](#update-appointment)
-   [Twilio-OpenAI Integration](#twilio-openai-integration)
    -   [Twilio Welcome Endpoint](#twilio-welcome-endpoint)
    -   [Twilio Incoming Call](#twilio-incoming-call)
-   [Steps to Test in Postman](#steps-to-test-in-postman)
-   [Testing with Swagger UI](#testing-with-swagger-ui)

## Introduction

This document provides instructions on how to test the application endpoints using Postman. It includes details on the request body, expected response, and steps to validate each endpoint.

## Accessing Swagger UI

The API documentation is available through Swagger UI at:

-   URL: `http://localhost:8000/api`

Swagger UI provides an interactive interface to explore the API endpoints, view request and response schemas, and test endpoints directly from your browser.

## Auth Endpoints

### 1. Register a New User

-   **Endpoint:** `POST http://localhost:8000/auth/register`
-   **Request Body:**

    ```json
    {
      "email": "user@example.com",
      "password": "yourPassword",
      "username": "john_doe",
      "phone": "1234567890",
      "company": "Your Company",
      "title": "Your Title"
    }
    ```
-   **Expected Response:**
    - Returns a JSON object containing:
         - `message`: Success message.
         - `access_token`: The JWT token (if provided by the sign-up response; otherwise, null).
         - `refresh_token`: The refresh token (if provided by the sign-up response; otherwise, null).
         - `user`: An object with the registered user's details.
    - **Note:** Registration does not automatically log in the user. Tokens are returned only if available in the sign-up response.
    - Example response:
    ```json
    {
      "message": "User registered successfully",
      "access_token": "YOUR_ACCESS_TOKEN_OR_NULL",
      "refresh_token": "YOUR_REFRESH_TOKEN_OR_NULL",
      "user": {
          "id": "USER_ID",
          "email": "user@example.com"
          // ...other user properties...
      }
    }
    ```

### 2. Login User

-   **Endpoint:** `POST http://localhost:8000/auth/login`
-   **Request Body:**

    ```json
    {
        "email": "user@example.com",
        "password": "yourPassword"
    }
    ```
-   **Expected Response:**
    -   JSON object containing an access token.

    ```json
    {
        "token": "access-token-here"
    }
    ```

### 3. Get Current User Token

-   **Endpoint:** `GET http://localhost:8000/auth/token`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Expected Response:**
    -   The current user's JWT token.

### 4. Get Current User Information

-   **Endpoint:** `GET http://localhost:8000/auth/user`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Expected Response:**
    -   JSON object containing details of the logged-in user from Supabase Auth.

### 5. Refresh Access Token

- **Endpoint:** `POST http://localhost:8000/auth/refresh`
- **Request Body:**

    ```json
    {
      "refresh_token": "your_refresh_token"
    }
    ```

- **Expected Response:**
    - Returns a JSON object containing:
         - A new `access_token`
         - A new `refresh_token` 
    - Example response:
    ```json
    {
      "access_token": "NEW_ACCESS_TOKEN",
      "refresh_token": "NEW_REFRESH_TOKEN"
    }
    ```

## Customer Endpoints

### 5. Get Logged-In Customer Data

-   **Endpoint:** `GET http://localhost:8000/customers`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Expected Response:**
    -   JSON object with customer details for the authenticated user.

### 6. Get Specific Customer Data

-   **Endpoint:** `GET http://localhost:8000/customers/:uuid`
-   **URL Parameter:**
    -   `:uuid` – Customer UUID
-   **Expected Response:**
    -   JSON object with customer details if found.
    -   Responds with a 404 if no customer exists with the provided UUID.

### 7. Delete the Logged-In User

-   **Endpoint:** `DELETE http://localhost:8000/customers`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Expected Response:**
    -   Confirmation of deletion using Supabase admin API.

### 8. Update Customer Credits by UUID

-   **Endpoint:** `PATCH http://localhost:8000/customers/:uuid/credits`
-   **Request Body:**

    ```json
    {
        "credits": 100
    }
    ```
-   **Expected Response:**
    -   JSON object with updated credits.

### 9. Get Customer Data by Email

-   **Endpoint:** `GET http://localhost:8000/customers/email/:email`
-   **URL Parameter:**
    -   `:email` – Customer email address
-   **Expected Response:**
    -   JSON object with customer details if found.
    -   Responds with a 404 if no customer exists with the provided email.

### 10. Update Customer Profile

-   **Endpoint:** `PATCH http://localhost:8000/customers/update-profile`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Request Body (all fields are optional):**

    ```json
    {
        "username": "new_username",
        "phone": "+1234567890",
        "company": "New Company",
        "title": "New Title"
    }
    ```
-   **Expected Response:**
    -   JSON object with the updated customer profile details.


## Voice Agent Endpoints

### 11. Create a Voice Agent

-   **Endpoint:** `POST http://localhost:8000/v1/voice-agents`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Body:** (JSON)

    ```json
    {
      "name": "My Voice Agent",
      "private_settings": {
        "model": {
          "voice": "will"
        }
      }
    }
    ```
    -   Not required (it will use default settings).
-   **Expected Response:**
    -   The newly created voice agent with default settings.
    -   An entry in the `voice_agents_access` table with access set to "owner".

### 12. Update a Voice Agent

-   **Endpoint:** `PATCH http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Body:** (JSON)

    ```json
    {
      "name": "My Voice Agent",
      "private_settings": {
        "model": {
          "voice": "will"
        }
      }
    }
    ```
-   **Expected Response:**
    -   The updated voice agent details including the new name and voice settings.
    -   Example:
    ```json
    {
      "id": "voice-agent-uuid",
      "name": "My Voice Agent",
      "private_settings": {
        "model": {
          "voice": "will",
          // ... other model settings remain unchanged ...
        }
      },
      // ... other voice agent fields ...
    }
    ```

### 13. Retrieve All Voice Agents

-   **Endpoint:** `GET http://localhost:8000/v1/voice-agents`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Expected Response:**

    ```json
    {
        "message": "No voice agents found for this user",
        "voiceAgents": []
    }
    ```

    or if agents exist:

    ```json
    [
        {
            "id": "uuid-1",
            "name": "My Voice Agent",
            "created_by": "user-uuid",
            "last_trained_at": "2024-02-12T12:00:00Z",
            "summary": {},
            "takeOverTimeout": "300s",
            "created_at": "2024-02-12T10:00:00Z"
        }
    ]
    ```
-   **Notes:**
    -   Returns only voice agents owned by the authenticated user.
    -   Requires authentication.
    -   Returns a message if no agents are found.

### 14. Retrieve a Single Voice Agent

-   **Endpoint:** `GET http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>` (Required)
-   **Expected Response:**
    -   The details of the specified voice agent.
-   **Notes:**
    -   Requires authentication
    -   Uses the user ID from the authentication token
    -   Returns 404 if voice agent is not found
    -   Returns 401 if not authenticated

### 15. Delete a Voice Agent

-   **Endpoint:** `DELETE http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Expected Success Response:**

    ```json
    {
        "message": "Voice agent \"My Agent\" deleted successfully. Removed 2 access entries and 1 business details.",
        "id": "voice-agent-uuid",
        "name": "My Agent",
        "deletedAccessEntries": 2,
        "deletedBusinessDetails": 1
    }
    ```
-   **Possible Error Responses:**
    -   **404 Not Found:**

        ```json
        {
            "message": "Voice agent with ID xxx not found or already deleted"
        }
        ```
    -   **400 Bad Request:**

        ```json
        {
            "message": "Voice agent ID is required"
        }
        ```
    -   **500 Internal Server Error:**

        ```json
        {
            "message": "Failed to delete voice agent: [error details]"
        }
        ```
-   **Notes:**
    -   Deletes the voice agent and all related data (access entries and business details)
    -   Automatically decrements the customer's total voice agent count
    -   Returns counts of deleted related entries
    -   Provides detailed error messages for various failure scenarios
    -   Handles cases where the voice agent is already deleted
    -   Requires owner access to delete the voice agent

### 16. Update Last Trained Timestamp

-   **Endpoint:** `PATCH http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/trained`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Expected Response:**
    -   The voice agent updated with the current timestamp in the `last_trained_at` field.

### 17. Update Takeover Settings

-   **Endpoint:** `PATCH http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/takeover`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Query Parameter:** (optional)
    -   `takeOverTimeout=<timeout_value>`
-   **Expected Response:**
    -   The voice agent updated with the new takeover timeout setting.

### 18. Update Private Settings

-   **Endpoint:** `PATCH http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/settings`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Body:** (JSON)

    ```json
    {
        "private_settings": {
            "noAnswerMessage": "I'm sorry, I don't have the answer for that.",
            "model": {
                "model": "gpt-4o-realtime-preview-2024-12-17",
                "instruction": "Primary Function: You are a customer support agent...",
                "persona": "Identity: You are a dedicated customer support agent...",
                "constraints": "No Data Divulge: Never mention that you have access to training data...",
                "temperature": 0.6,
                "assistantLanguage": "english",
                "aiInputLanguage":"any"
            }
        }
    }
    ```
-   **Expected Response:**
    -   The voice agent updated with the new private settings.

### 19. Get Voice Agent Permissions

-   **Endpoint:** `GET http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/permissions`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Expected Response:**
    -   JSON object containing permission details (access, status) for the authenticated user.

### 20. Fetch Detailed Voice Agent Data

-   **Endpoint:** `GET http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/details`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Expected Response:**
    -   Detailed data of the voice agent including private settings, summary, and customer data.

### 21. Update Twilio Phone Number

-   **Endpoint:** `PATCH http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/twilio-phone`
-   **Headers:**
    -   `Authorization: Bearer <YOUR_TOKEN>`
-   **Body:** (JSON)

    ```json
    {
        "phoneNumber": "+19895644594"
    }
    ```
-   **Description:** 
    -   Updates the Twilio phone number associated with a voice agent.
    -   The phone number must be in E.164 format without spaces (e.g., +19895644594).
    -   Any spaces in the provided phone number will be automatically removed.
-   **Expected Response:**
    -   The voice agent object with the updated Twilio phone number.
-   **Possible Error Responses:**
    -   **400 Bad Request:**
        ```json
        {
            "message": "Phone number must be in E.164 format (e.g., +19895644594)"
        }
        ```
    -   **404 Not Found:**
        ```json
        {
            "message": "Voice agent with ID xxx not found"
        }
        ```
    -   **500 Internal Server Error:**
        ```json
        {
            "message": "Failed to update Twilio phone number: [error details]"
        }
        ```
-   **Notes:**
    -   Requires authentication
    -   Automatically removes any spaces from the phone number
    -   Validates that the phone number starts with + followed by digits only
    -   Stores the phone number in E.164 format for consistent handling

### 22. [Admin Only] Update System Messages for All Voice Agents

- **Endpoint:** `POST http://localhost:8000/v1/voice-agents/update-system-messages`
- **Headers:**
  - `Authorization: Bearer <access-token>`
- **Description:** Updates the SYSTEM_MESSAGE field of all voice agents to match the default configuration from createDefaultVoiceagent.
- **Required Permissions:** 
  - Must be authenticated
  - Must have admin privileges
- **Expected Response:**
    ```json
    {
      "updated": 5,
      "message": "Successfully updated SYSTEM_MESSAGE for 5 voice agents"
    }
    ```
- **Error Responses:**
  - **401 Unauthorized:**
    ```json
    {
      "message": "Unauthorized - Valid authentication required"
    }
    ```
  - **403 Forbidden:**
    ```json
    {
      "message": "Forbidden - Admin privileges required to perform this action"
    }
    ```
  - **500 Internal Server Error:**
    ```json
    {
      "message": "Failed to update system messages: [error details]"
    }
    ```

## Business Endpoints

### 23. Create a Business

-   **Endpoint:** `POST http://localhost:8000/v1/business/:voice_agent_id`
-   **URL Parameter:**
    -   `:voice_agent_id` – The UUID of the voice agent to link the business to.
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Request Body:**

    ```json
    {
        "business_name": "Acme Corp",
        "business_phone": "+1234567890",
        "type_of_business": "Retail",
        "additional_context": "Located in downtown",
        "business_timezone": "America/New_York",
        "default_appointment_length": 90,
        "operating_schedule": {
            "Friday": {
                "open": true,
                "closing_time": "18:00",
                "opening_time": "09:00"
            },
            "Sunday": {
                "open": true,
                "closing_time": "16:00",
                "opening_time": "09:00"
            }
        }
    }
    ```
-   **Notes:**
    -   The `business_summary` field in the business details table is auto-generated from the system during voice agent training. You do not need to include it in the request body, though it is possible to override it if desired.
    -   The `default_appointment_length` field specifies the standard duration for appointments in minutes. If not provided, it defaults to 60 minutes. This affects scheduling and availability calculations.
    -   The `business_timezone` field must be a valid IANA timezone string:
        - **What is IANA format?** The IANA Time Zone Database (also called the "Olson database") is the standard for timezone identification used in computing. It defines timezone identifiers like "America/New_York" rather than ambiguous abbreviations like "EST".
        - **Valid examples:** "America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
        - **Invalid formats to avoid:** 
          - Abbreviations like "EST", "PST" (ambiguous and not standard)
          - UTC offsets like "UTC+2" (don't account for daylight saving time changes)
          - Descriptive names like "Eastern Time" (not standardized)
        - **Why it matters:** Using IANA identifiers ensures proper handling of:
          - Daylight saving time transitions
          - Historical timezone changes
          - Correct time calculations for appointments
          - Accurate business hour displays across different regions
        - **Reference:** For a complete list of valid IANA timezone identifiers, consult the [IANA Time Zone Database](https://www.iana.org/time-zones) or use the [List of tz database time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) on Wikipedia.
    -   Frontend implementation tip: Use a timezone selector component that offers a dropdown of standard IANA timezone options rather than free text input to prevent errors.
    -   The operating\_schedule can be partially provided. Days not specified will use default values:
        -   Weekdays (Mon-Fri): 9am-5pm, open=true
        -   Weekends (Sat-Sun): 9am-5pm, open=false
-   **Expected Response:**

    ```json
    {
        "id": "uuid",
        "business_name": "Acme Corp",
        "business_phone": "+1234567890",
        "type_of_business": "Retail",
        "additional_context": "Located in downtown",
        "business_timezone": "America/New_York",
        "operating_schedule": {
            "Monday": {
                "opening_time": "09:00",
                "closing_time": "17:00",
                "open": true
            },
            "Tuesday": {
                "opening_time": "09:00",
                "closing_time": "17:00",
                "open": true
            },
            "Wednesday": {
                "opening_time": "09:00",
                "closing_time": "17:00",
                "open": true
            },
            "Thursday": {
                "opening_time": "09:00",
                "closing_time": "17:00",
                "open": true
            },
            "Friday": {
                "opening_time": "09:00",
                "closing_time": "18:00",
                "open": true
            },
            "Saturday": {
                "opening_time": "09:00",
                "closing_time": "17:00",
                "open": false
            },
            "Sunday": {
                "opening_time": "09:00",
                "closing_time": "16:00",
                "open": true
            }
        }
    }
    ```
-   **Possible Error Responses:**
    -   **409:** A business is already linked to this voice agent.
    -   **403:** The voice agent does not belong to the user.
    -   **400:** Invalid timezone format. Please use a valid IANA timezone identifier.

### 24. Update a Business

-   **Endpoint:** `PATCH http://localhost:8000/v1/business/<BUSINESS_ID>`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Request Body:**

    ```json
    {
        "business_name": "New Business Name",
        "business_phone": "+19876543210",
        "type_of_business": "Wholesale",
        "additional_context": "New location details",
        "business_timezone": "Europe/London",
        "operating_schedule": {
            "Monday": "10 to 6",
            "Tuesday": "10 to 6"
        }
    }
    ```
-   **Notes:**
    -   The `business_summary` field is automatically updated based on the voice agent's generated summary, so you do not need to supply it in the update request, but you may include it if needed.
    -   When updating the `business_timezone` field, you must use a valid IANA timezone identifier:
        - **IANA format requirements:** The identifier must follow the Region/City format (e.g., "America/New_York")
        - **Common regions:** Africa, America, Antarctica, Asia, Atlantic, Australia, Europe, Indian, Pacific
        - **Validation:** The backend will validate that the provided timezone exists in the IANA database
        - **Default behavior:** If omitted or invalid, the system may default to UTC or retain the previous valid setting
        - **Consistency:** Use the same IANA format across all your applications to ensure data consistency
    -   For best user experience, implement a timezone selector in your frontend with the following features:
        -   Dropdown menu of common timezones with user-friendly names
        -   Search functionality to quickly find timezones
        -   Group timezones by region for easier navigation
        -   Display both the timezone name and current offset (e.g., "America/New_York (UTC-05:00)")
    -   The timezone is important for correctly scheduling appointments and displaying business hours to customers in their local time.
-   **Expected Response:**
    -   JSON object with updated business details.

### 25. Delete a Business

-   **Endpoint:** `DELETE http://localhost:8000/v1/business/<BUSINESS_ID>`
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Expected Response:**
    -   JSON object confirming the deletion of the business.

### 26. Get Operating Schedule by Voice Agent ID

-   **Endpoint:** `GET http://localhost:8000/v1/business/schedule/:voice_agent_id`
-   **URL Parameter:**
    -   `:voice_agent_id` – The UUID of the voice agent whose business schedule to retrieve.
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Description:** 
    -   Retrieves the operating schedule and business ID for a business linked to the specified voice agent.
    -   This endpoint is useful for getting business hours without needing to retrieve the entire business record.
-   **Expected Response:**
    ```json
    {
      "businessId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "operatingSchedule": {
        "Monday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": true
        },
        "Tuesday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": true
        },
        "Wednesday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": true
        },
        "Thursday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": true
        },
        "Friday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": true
        },
        "Saturday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": false
        },
        "Sunday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": false
        }
      }
    }
    ```
-   **Possible Error Responses:**
    -   **404:** Business not found for the specified voice agent.
    -   **500:** Internal server error.

### 27. Update Specific Days in Operating Schedule

-   **Endpoint:** `PATCH http://localhost:8000/v1/business/:business_id/schedule`
-   **URL Parameter:**
    -   `:business_id` – The UUID of the business to update the schedule for (not voice agent ID).
-   **Headers:**
    -   `Authorization: Bearer <access-token>`
-   **Description:** 
    -   Updates only the provided days in the operating schedule without affecting other days.
    -   For each day, only the provided fields are updated, preserving existing values for fields not included.
    -   This makes it easy to update just a single field for a single day without needing to send the entire schedule.
-   **Request Body:**
    ```json
    {
      "operating_schedule": {
        "Monday": {
          "opening_time": "10:00",
          "closing_time": "18:00"
        },
        "Friday": {
          "open": false
        }
      }
    }
    ```
-   **Notes:**
    -   You only need to include the days and fields you want to update.
    -   Other days and fields will remain unchanged.
    -   Valid fields for each day are `opening_time`, `closing_time`, and `open`.
    -   Time values should be in 24-hour format (HH:MM).
-   **Example:** To change Monday's opening time and mark the business as closed on Friday, you only need to provide those specific values.
-   **Expected Response:**
    ```json
    {
      "message": "Operating schedule updated successfully",
      "updatedDays": ["Monday", "Friday"],
      "operatingSchedule": {
        "Monday": {
          "opening_time": "10:00",
          "closing_time": "18:00",
          "open": true
        },
        "Tuesday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": true
        },
        // ... other days remain unchanged ...
        "Friday": {
          "opening_time": "09:00",
          "closing_time": "17:00",
          "open": false
        },
        // ... remaining days ...
      }
    }
    ```
-   **Possible Error Responses:**
    -   **404:** Business not found with the specified ID.
    -   **400:** Invalid request format.
    -   **500:** Internal server error.

### 28. Get Business Details by Voice Agent ID

**URL**: `GET /v1/business/:voice_agent_id/details`

**Headers**:
- `Authorization`: Bearer token

**Description**: Retrieves complete business information including operating schedule, contact details, and business metadata for a business linked to the specified voice agent.

**Response**:
```json
{
  "id": "uuid",
  "business_name": "Acme Corp",
  "business_phone": "+1234567890",
  "business_timezone": "America/New_York",
  "type_of_business": "Retail",
  "business_summary": "A retail store specializing in...",
  "additional_context": "Additional business information...",
  "voice_agent_id": "voice-agent-uuid",
  "operating_schedule": {
    "monday": {
      "opening_time": "09:00",
      "closing_time": "17:00",
      "open": true
    },
    // ... other days
  }
}
```

**Error Responses**:
- `404 Not Found`: Business with the specified voice agent ID was not found
- `401 Unauthorized`: Invalid or missing authentication token

## Training Endpoints

### 29. Website Training
- **Endpoint:** `POST http://localhost:8000/:voice_agent_id/training/website`
- **Headers:**
  - `Authorization: Bearer <access-token>`
  - `Content-Type: application/json`
- **Query Parameters:**
  - `type=website`
- **Request Body:**
    ```json
    {
      "data": ["https://example.com", "https://example2.com"],
      "scrappingId": "unique-scrapping-id"
    }
    ```
- **Note:**  
Before using this endpoint, first call the scraping endpoint:
  
  `POST http://localhost:8000/scraping/scrape`
  
This endpoint returns a response with a `scrapping_id` and the scraped URLs. Then use the returned `scrapping_id` in the website training request.
- **Expected Response:**
    ```json
    {
      "msg": "Training has started",
      "voiceAgentId": "your-voice-agent-id",
      "scrappingId": "unique-scrapping-id"
    }
    ```

### 30. Text Training
- **Endpoint:** `POST http://localhost:8000/:voice_agent_id/training/text`
- **Headers:**
  - `Authorization: Bearer <access-token>`
  - `Content-Type: application/json`
- **Query Parameters:**
  - `type=text`
- **Request Body:**
    ```json
    {
      "name": "My Text Document",
      "data": "Your text content here"
    }
    ```
- **Expected Response:**
    ```json
    {
      "msg": "Training has started",
      "voiceAgentId": "your-voice-agent-id"
    }
    ```

### 31. File Upload Training
- **Endpoint:** `POST http://localhost:8000/:voice_agent_id/training/file`
- **Headers:**
  - `Authorization: Bearer <access-token>`
  - `Content-Type: multipart/form-data`
- **Query Parameters:**
  - `type=file` (required)
- **Form Data:**
  - Key: `files` (select one or more files)
- **Expected Response:**
    ```json
    {
      "msg": "Training has started",
      "voiceAgentId": "your-voice-agent-id"
    }
    ```
- **Supported File Types:**
  - PDF (`.pdf`)
  - Microsoft Word (`.doc`, `.docx`)
  - Text files (`.txt`)
  - CSV files (`.csv`)
- **Maximum file size:** 25MB

### 32. Audio Training
- **Endpoint:** `POST http://localhost:8000/:voice_agent_id/training/audio`
- **Headers:**
  - `Authorization: Bearer <access-token>`
  - `Content-Type: multipart/form-data`
- **Query Parameters:**
  - `transcription_service` (required) - Either 'openai' or 'elevenlabs'. Used for audio file transcription.
- **Form Data:**
  - Key: `files` (select one or more audio files)
- **Expected Response:**
    ```json
    [
      {
        "msg": "Audio training has started",
        "voiceAgentId": "your-voice-agent-id",
        "transcription": "The transcribed text from your audio file will appear here. This could be multiple sentences long and contain the full transcription of the audio content."
      }
    ]
    ```
- **Response Fields:**
  - `msg`: Training status message
  - `voiceAgentId`: The ID of the voice agent being trained
  - `transcription`: The full text transcription of the audio file
- **Supported Audio File Types:**
  - MP3 (`.mp3`)
  - MP4 (`.mp4`)
  - MPEG (`.mpeg`)
  - MPGA (`.mpga`)
  - M4A (`.m4a`)
  - WAV (`.wav`)
  - WEBM (`.webm`)
- **Audio File Processing:**
  - **Transcription Services:**
    - **OpenAI:**
      - Best for general transcription
      - Uses gpt-4o-mini-transcribe model
      - Example: `POST /your-agent-id/training/audio?transcription_service=openai`
    - **ElevenLabs:**
      - Better for multi-speaker audio
      - Supports speaker diarization
      - Example: `POST /your-agent-id/training/audio?transcription_service=elevenlabs`
  - **Maximum file size:** 25MB
  - **Process Flow:**
    1. Audio file is uploaded
    2. Transcribed using selected service
    3. Transcription is converted to embeddings
    4. Embeddings are stored for training
  - **Example cURL Request:**
    ```bash
    curl -X POST \
      'http://localhost:8000/your-agent-id/training/audio?transcription_service=elevenlabs' \
      -H 'Authorization: Bearer {{auth_token}}' \
      -F 'files=@/path/to/your/audio.mp3'
    ```

### Common Error Responses

-   **401 Unauthorized:**
    ```json
    {
        "message": "Unauthorized"
    }
    ```
-   **400 Bad Request:**
    ```json
    {
        "message": "Missing required parameters"
    }
    ```
-   **500 Internal Server Error:**
    ```json
    {
        "message": "An error occurred while processing the request"
    }
    ```

## Scraping Endpoints

### 33. Scrape Multiple Websites (Scrapes specified websites and returns their preview data)
- **Endpoint:** `POST http://localhost:8000/scraping/scrape`
- **Headers:**
  - `Authorization: Bearer <access-token>`
  - `Content-Type: application/json`
- **Request Body:**
    ```json
    {
      "urls": ["https://texagon.io/", "https://www.dummywebsite.com/"]
    }
    ```
- **Expected Response:**
    ```json
    {
      "message": "Websites scraped successfully",
      "scrapping_id": "abc123",
      "count": 2
    }
    ```

### 34. Scan URL Progress (SSE) (Streams real-time progress for URL scanning)
### 31. Scan URL Progress (SSE) (Streams real-time progress for URL scanning)
- **Endpoint:** `GET http://localhost:8000/scraping`
- **Headers:**
  - `Authorization: Bearer <access-token>`
  - `Accept: text/event-stream`
- **Query Parameter:** `url=<full-url-to-scan>`
- **Expected Behavior:**
  - Initiates scanning of the provided URL and streams progress via Server-Sent Events:
    - `init`: Sends total URLs discovered.
    - `url_processed`: Updates as each URL is processed.
    - `req_completed`: Final summary with `scrapping_id` and results.
    - `complete`: Indicates scanning completion.
- **Note:** Ensure the client supports SSE and the URL provided is valid.

### 35. Fetch URL
- **Endpoint:** `GET http://localhost:8000/scraping/fetch-url`
- **Headers:** `Authorization: Bearer <access-token>`
- **Query Parameter:** `url=<url-to-fetch>`
- **Description:** This endpoint uses node-fetch to retrieve the raw response from the specified URL.
- **Expected Response:** Returns the response from the requested URL.

### Scraping Flow & Usage

- **Flow:**  
  1. When you need to scrape multiple specified websites at once, use the POST `/scraping/scrape` endpoint. The provided URLs are scraped in parallel, the results are stored in your database under a generated scrapping ID, and a summary response is returned.
  2. For a detailed, step-by-step scanning of a single page (e.g., to extract all internal URLs), use the GET `/scraping` endpoint. This endpoint streams the progress so you can monitor which parts of the page are processed.
  
- **Why & When to Use:**  
  - Use the bulk scraping endpoint when you have a list of predefined websites to scrape for content aggregation or training purposes.  
  - Use the scanning endpoint to dynamically discover and process links from a single page, especially if the page has a lot of dynamic content.
  
- **How to Use:**  
  - Ensure the request body for the bulk endpoint contains an array of valid URLs.  
  - For the scanning endpoint, pass the target page URL as a query parameter and set up your client to handle SSE events for live progress updates.

## Context Endpoint

### 36. Context Endpoint
- **Endpoint:** `POST http://localhost:8000/context`
- **Description:** This endpoint converts the provided query string into an embedding and retrieves matching context from the knowledge base associated with the specified voice agent.
- **Headers:**
  - `Authorization: Bearer <access-token>` must be included.
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "voiceAgentId": "voice-agent-123",
    "query": "How to reset password?"
  }
  ```
- **Example Request:**
  ```http
  POST /context HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer your_access_token
  Content-Type: application/json

  {
    "voiceAgentId": "12345",
    "query": "How to reset password?"
  }
  ```
- **Expected Response:**
  ```json
  [
    {
      "context": "To reset your password, click on the 'Forgot Password' link on the login page and follow the instructions sent to your email."
    },
    {
      "context": "Password reset instructions will be sent to your registered email address."
    }
  ]
  ```
- **Additional Notes:**
  - Both `voiceAgentId` and `query` fields are required in the request body.
  - If either field is missing, a 400 Bad Request error will be returned.
  - In case of issues with the embeddings or the search process, an error object with a suitable message will be returned.

## Voice Agent and Business Configuration

- **Endpoint:** `GET http://localhost:8000/agent-config/:voice_agent_id`
- **Description:** Retrieves a voice agent's details along with its business configuration. Real-time updates are available via SSE.
- **Usage Example:**  
  `GET http://localhost:8000/agent-config/12345`
- **Expected Response:**
    ```json
    {
      "voiceAgent": {
         "id": "uuid",
         "name": "Voice Agent Name",
         "private_settings": {
            "model": {
               "SYSTEM_MESSAGE": "Welcome to our service. How can I help you today?",
               "noAnswerMessage": "I'm sorry, I don't have the answer for that."
            }
         }
         // ...additional voice agent fields...
      },
      "business": {
         "id": "uuid",
         "business_name": "Business Name",
         "type_of_business": "Retail",
         "operating_schedule": {
            "Monday": {
               "opening_time": "09:00",
               "closing_time": "17:00",
               "open": true
            }
            // ...other days...
         }
         // ...additional business fields...
      }
    }
    ```

## Functions Endpoints

### 37. Create a Function
- **Endpoint:** `POST http://localhost:8000/functions`
- **Headers:** 
  - `Authorization: Bearer <access-token>`
  - `Content-Type: application/json`
- **Description:** Creates a new function that can be used as a tool by the AI assistant.
- **Example Request Body for JSON API Function:**
    ```json
    {
      "name": "query_company_info",
      "purpose": "Search through company knowledge base for relevant information",
      "trigger_reason": "when user asks a question related to company or business",
      "assistant_id": "voice_agent_id",
      "type": "json_api",
      "data": {
        "headers": {
          "Authorization": "Bearer {{access_token}}"
        },
        "body": {
          "voiceAgentId": "{{voice_agent_id}}",
          "query": "{{query}}"
        },
        "req_url": "https://build-operatorai-backend-production.up.railway.app/context",
        "req_type": "POST"
      },
      "variables": [
        {
          "var_id": "1",
          "var_name": "query",
          "var_type": "text",
          "var_reason": "The search query about company information",
          "var_default": "true"
        }
      ]
    }
    ```
- **Expected Response:**
    ```json
    {
      "id": "function-uuid",
      "name": "query_company_info",
      "type": "json_api",
      "created_by": "user-uuid",
      "assistant_id": "voice_agent_id",
      "is_active": true,
      "purpose": "Search through company knowledge base for relevant information",
      "trigger_reason": "when user asks a question related to company or business",
      "data": {
        // ... data object as provided in request ...
      },
      "variables": [
        // ... variables array as provided in request ...
      ],
      "created_at": "2024-02-24T12:00:00.000Z"
    }
    ```
- **Notes:**
  - The `data` object structure varies based on the function type
  - For `json_api` type:
    - `body`: Request body parameters
    - `headers`: Request headers
    - `req_url`: The endpoint URL
    - `req_type`: HTTP method (GET, POST, etc.)
  - Variables must include `var_id`, `var_name`, `var_type`, `var_reason`, and `var_default`
  - The `{{variable}}` syntax in data fields indicates variable interpolation

### 38. Get All Functions
- **Endpoint:** `GET http://localhost:8000/functions`
- **Headers:** `Authorization: Bearer <access-token>`
- **Description:** Retrieves all functions created by the user.
- **Example Response:**
    ```json
    [
      { "id": "func1", "name": "Function One", ... },
      { "id": "func2", "name": "Function Two", ... }
    ]
    ```

### 39. Get Function by ID
- **Endpoint:** `GET http://localhost:8000/functions/:id`
- **Headers:** `Authorization: Bearer <access-token>`
- **Description:** Retrieves a specific function by its ID.
- **Example Request:**
    ```http
    GET /functions/12345 HTTP/1.1
    Authorization: Bearer <access-token>
    ```

### 40. Update a Function
- **Endpoint:** `PATCH http://localhost:8000/functions/:id`  // Changed from PUT to PATCH
- **Headers:** `Authorization: Bearer <access-token>`
- **Body:** JSON object matching UpdateFunctionDto properties.
- **Description:** Updates an existing function.
- **Example Request:**
    ```json
    {
      "name": "Updated Function Name",
      "purpose": "Updated purpose",
      "trigger_reason": "Updated trigger",
      "variables": [ ... ]
    }
    ```

### 41. Delete a Function
- **Endpoint:** `DELETE http://localhost:8000/functions/:id`
- **Headers:** `Authorization: Bearer <access-token>`
- **Description:** Permanently deletes a function. Creator access required.
- **Success Response (200):**
  ```json
  {
    "message": "Function \"query_company_info\" deleted successfully",
    "deleted_function": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "query_company_info",
      "type": "function",
      "purpose": "Search through company knowledge base",
      "created_at": "2024-02-24T14:59:23.000Z",
      "created_by": "user-uuid"
    }
  }
  ```
- **Error Responses:**
  - 401: Unauthorized - Invalid or missing token
  - 404: Not Found - Function doesn't exist
  - 400: Bad Request - Error during deletion

### 42. Upload Files
- **Endpoint:** `POST http://localhost:8000/functions/upload`
- **Headers:** `Authorization: Bearer <access-token>` and `multipart/form-data`
- **Description:** Upload files related to a function.
- **Example:** Use Postman file upload feature to attach files under the key `files`.

### 43. Update Function Status
- **Endpoint:** `PATCH http://localhost:8000/functions/:id/:status`  // Changed from PUT to PATCH

### 44. Get Functions by Assistant ID
- **Endpoint:** `GET http://localhost:8000/functions/assistant/:assistant_id`
- **Headers:** `Authorization: Bearer <access-token>`
- **URL Parameter:**
  - `:assistant_id` – The assistant identifier used to fetch functions.
- **Description:** Retrieves a list of functions associated with the specified assistant_id.
- **Example Request:**
  ```http
  GET /functions/assistant/db455d7f-594a-4b00-8012-c0af5395d0f6 HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer your_access_token
  ```
- **Expected Response:**
  ```json
  [
    {
      "id": "function_id",
      "name": "Function Name",
      "type": "function",
      "description": "Description of the function",
      "created_by": "user-id",
      "assistant_id": "db455d7f-594a-4b00-8012-c0af5395d0f6",
      "variables": [ ... ]
    }
    // ...other functions...
  ]
  ```

### [Admin Only] Update Default Functions for All Voice Agents
- **Endpoint:** `POST http://localhost:8000/functions/update-default-functions`
- **Headers:**
  - `Authorization: Bearer <access-token>`
- **Description:** Updates the default functions of all voice agents to match the current default configuration in the code. Does not affect custom functions.
- **Required Permissions:** 
  - Must be authenticated
  - Must have admin privileges
- **Expected Response:**
    ```json
    {
      "updated": 15,
      "message": "Successfully updated 15 default functions across all voice agents"
    }
    ```
- **Error Responses:**
  - **401 Unauthorized:**
    ```json
    {
      "message": "Unauthorized - Valid authentication required"
    }
    ```
  - **403 Forbidden:**
    ```json
    {
      "message": "Forbidden - Admin privileges required to perform this action"
    }
    ```
  - **500 Internal Server Error:**
    ```json
    {
      "message": "Failed to update default functions: [error details]"
    }
    ```

## Tools Endpoints

### Get Tools by Assistant ID
- **Endpoint:** `GET http://localhost:8000/tools/:assistant_id`
- **Headers:** `Authorization: Bearer <access-token>`
- **URL Parameter:**
  - `:assistant_id` – The assistant identifier for which functions (tools) are fetched.
- **Description:** Retrieves a list of functions (tools) associated with the specified assistant_id.
- **Example Request:**
  ```http
  GET /tools/db455d7f-594a-4b00-8012-c0af5395d0f6 HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer your_access_token
  ```
- **Expected Response:**
  ```json
  [
    {
      "type": "function",
      "name": "Function Name",
      "description": "Description of the function",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": { "type": "string", "description": "Parameter description" }
        },
        "required": ["param1"]
      }
    }
    // ...other functions...
  ]
  ```

### Get Function Data by Assistant ID
- **Endpoint:** `GET http://localhost:8000/tools/function-data/:assistant_id`  // Updated endpoint path
- **Headers:** `Authorization: Bearer <access-token>`
- **URL Parameter:**
  - `:assistant_id` – The assistant identifier for which function data is fetched.
- **Description:** Retrieves detailed function data including name, purpose, trigger reason, variables, and additional data for all functions associated with the specified assistant_id.
- **Example Request:**
  ```http
  GET /tools/function-data/db455d7f-594a-4b00-8012-c0af5395d0f6 HTTP/1.1  // Updated example
  Host: localhost:8000
  Authorization: Bearer your_access_token
  ```
- **Expected Response:**
  ```json
  [
    {
      "name": "Function Name",
      "purpose": "Function Purpose",
      "trigger_reason": "Function Trigger Reason",
      "variables": [
        {
          "var_name": "parameter1",
          "var_reason": "Parameter description",
          "var_default": "true"
        }
      ],
      "data": {
        // Additional function-specific data
      }
    }
    // ...other functions...
  ]
  ```

## Realtime Endpoints

### Create Realtime Session

- **Endpoint:** `GET http://localhost:8000/realtime/session/<voice_agent_id>`
- **Headers:**
  - `Authorization: Bearer <access-token>`
- **Description:** Initiates a realtime session by calling the realtime service. This endpoint retrieves configuration settings, fetches dynamic tools, and returns the session details.
- **Request Example:**
  ```http
  GET /realtime/session/12345 HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer your_access_token
  ```
- **Expected Response:**  
  A JSON object containing the session details (e.g., model, voice, instructions, tools, etc.).

## Appointments Endpoints

### Create a New Appointment
- **Endpoint:** `POST http://localhost:8000/appointments`
- **Headers:** 
  - `Authorization: Bearer <access-token>`
  - `Content-Type: application/json`
- **Request Body:**
    ```json
    {
      "voice_agent_id": "92bb944f-032e-44c0-8f73-0acb7527bd45",
      "name": "John Doe",
      "phone_number": "12345",
      "service": "Consultation",
      "special_notes": "Bring project plan",
      "schedule_time": "2025-03-03T15:36:27Z",
      "status": "pending"  // Optional, defaults to 'pending'
    }
    ```
- **Expected Response:**
    - A JSON object with the created appointment details, including its autogenerated `id` and `created_at` timestamp.
- **Notes:**
    - Ensure the `voice_agent_id` exists.
    - The `status` field defaults to "pending" if not provided.
    - The `created_at` field automatically records the creation time.

### Get Appointments by Phone Number
- **Endpoint:** `GET http://localhost:8000/appointments/by-phone`
- **Headers:** 
  - `Authorization: Bearer <access-token>`
- **Query Parameters:**
  - `phone_number` - The phone number to search for (can be partial)
  - `voice_agent_id` - The ID of the voice agent
- **Description:** Retrieves all appointments associated with the given phone number for a specific voice agent. Performs a fuzzy search on the phone number.
- **Example Request:**
  ```http
  GET /appointments/by-phone?phone_number=555123&voice_agent_id=92bb944f-032e-44c0-8f73-0acb7527bd45 HTTP/1.1
  Host: localhost:8000
  Authorization: Bearer your_access_token
  ```
- **Expected Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "appointment-uuid",
        "name": "John Doe",
        "phone_number": "(555) 123-4567",
        "service": "Consultation",
        "schedule_time": "2025-03-03T15:36:27Z",
        "formatted_time": "Monday, March 3, 2025 at 3:36 PM",
        "status": "pending",
        "voice_agent_id": "92bb944f-032e-44c0-8f73-0acb7527bd45",
        "special_notes": "Bring project plan"
      }
      // ... other matching appointments
    ]
  }
  ```
- **Notes:**
  - The search is case-insensitive and matches partial phone numbers
  - Special characters (spaces, dashes, parentheses) in the phone number are ignored during search
  - Results are ordered by schedule time in ascending order
  - Each appointment includes a human-readable formatted time

### Get Booked Slots
- **Endpoint:** `GET http://localhost:8000/appointments/booked-slots`
- **Headers:** 
  - `Authorization: Bearer <access-token>`
- **Query Parameters:**
  - `voice_agent_id`: UUID of the voice agent
  - `date`: Date in YYYY-MM-DD format
- **Description:** Returns booked appointment slots for 3 consecutive days starting from the provided date
- **Example Request:**
    ```http
    GET /appointments/booked-slots?voice_agent_id=123e4567-e89b&date=2024-02-24
    ```
- **Expected Response:**
    ```json
    {
      "bookedSlots": {
        "2024-02-24": ["2024-02-24T10:00:00Z", "2024-02-24T14:30:00Z"],
        "2024-02-25": ["2024-02-25T11:00:00Z"],
        "2024-02-26": []
      }
    }
    ```
- **Notes:**
  - Returns slots for 3 consecutive days
  - Empty array means no bookings for that day
  - Times are in ISO format
  - Results are ordered chronologically

### Update Appointment
- **Endpoint:** `PATCH http://localhost:8000/appointments`
- **Headers:** 
  - `Authorization: Bearer <access-token>`
  - `Content-Type: application/json`
- **Request Body (id is required, other fields optional):**
    ```json
    {
      "id": "appointment-uuid",
      "name": "Updated Name",
      "phone_number": "555-0123",
      "schedule_time": "2024-03-15T14:00:00Z",
      "service": "Updated Service",
      "special_notes": "Updated notes",
      "status": "completed"
    }
    ```
- **Expected Response:**
    ```json
    {
      "success": true,
      "message": "Appointment successfully updated",
      "data": {
        "id": "appointment-uuid",
        "name": "Updated Name",
        "phone_number": "555-0123",
        "schedule_time": "2024-03-15T14:00:00Z",
        "service": "Updated Service",
        "special_notes": "Updated notes",
        "status": "completed",
        "formatted_time": "Friday, March 15, 2024 at 2:00 PM",
        "created_at": "2024-02-24T12:00:00Z",
        "updated_at": "2024-02-24T13:00:00Z"
      }
    }
    ```
- **Notes:**
  - The `id` field is required in the request body
  - All other fields are optional - only provide fields you want to update
  - Status must be one of: `pending`, `missed`, `completed`, `cancelled`
  - Cannot reschedule to a past date
  - `updated_at` is automatically set when any field is modified
  - Response includes human-readable formatted time

## Audio Transcription Endpoints

### Transcribe Audio File
- **Endpoint:** `POST http://localhost:8000/transcribe/audio`
- **Headers:** 
  - `Content-Type: multipart/form-data`
- **Query Parameters:**
  - `service`: (optional) The transcription service to use - either 'openai' (default) or 'elevenlabs'
- **Request Body:**
  - Form data with key `file` containing the audio file
  - Supported formats: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
  - Maximum file size: 25MB
- **Example Request:**
  ```http
  POST /transcribe/audio?service=elevenlabs HTTP/1.1
  Content-Type: multipart/form-data
  
  file: <audio_file>
  ```
- **Expected Response:**
  ```json
  {
    "success": true,
    "transcription": "Your transcribed text here...",
    "service": "elevenlabs"
  }
  ```
- **Error Response:**
  ```json
  {
    "success": false,
    "error": "Error message here",
    "service": "elevenlabs"
  }
  ```
- **Notes:**
  - Audio files are automatically deleted after transcription
  - OpenAI uses gpt-4o-mini-transcribe model
  - ElevenLabs uses scribe_v1 model with diarization support
  - Choose the service based on your specific needs:
    - OpenAI: Better for general transcription
    - ElevenLabs: Better for multi-speaker audio with diarization
  - Both services support multiple languages but may have different language codes

## ElevenLabs Text-to-Speech Endpoints

### Convert Text to Speech
- **Endpoint:** `POST http://localhost:8000/elevenlabs/text-to-speech`
- **Headers:** 
  - `Content-Type: application/json`
- **Request Body:**
    ```json
    {
      "text": "The text you want to convert to speech",
      "voiceId": "voice-id-here",
      "modelId": "eleven_monolingual_v1",
      "outputFormat": "mp3_44100_128"
    }
    ```
- **Request Fields:**
  - `text` (required): The text that will be converted to speech
  - `voiceId` (required): ID of the voice to be used for speech generation
  - `modelId` (optional): The model ID to use for generation. Defaults to 'eleven_monolingual_v1'
  - `outputFormat` (optional): Output format of the generated audio. Defaults to 'mp3_44100_128'
- **Expected Response:**
  - Returns the audio file directly with Content-Type: audio/mpeg
  - The response is a streamable audio file that can be played or downloaded
- **Error Responses:**
  - **400 Bad Request:**
    ```json
    {
      "message": "Missing required parameters"
    }
    ```
  - **401 Unauthorized:**
    ```json
    {
      "message": "Unauthorized - Valid ElevenLabs API key required"
    }
    ```
  - **500 Internal Server Error:**
    ```json
    {
      "message": "Text to speech conversion failed: [error details]"
    }
    ```
- **Notes:**
  - Requires a valid ElevenLabs API key configured on the server
  - The voice ID must be valid and accessible with your ElevenLabs account
  - Supported output formats include:
    - mp3_44100_128 (MP3 at 44.1kHz, 128kbps)
    - mp3_44100_64 (MP3 at 44.1kHz, 64kbps)
    - ulaw_8000 (μ-law 8kHz - suitable for telephony)
  - The response is streamed directly as an audio file, suitable for immediate playback or download

## Twilio-OpenAI Integration

### Twilio Welcome Endpoint
- **Endpoint:** `POST http://localhost:8000/twilio/welcome`
- **Headers:** 
  - `Content-Type: application/json`
- **Request Body:**
    ```json
    {
      "To": "+1234567890",
      "From": "+0987654321",
      "CallStatus": "ringing"
    }
    ```
- **Expected Response:**
    ```xml
    <Response>
      <Say>Welcome to our service. Please hold while we connect you.</Say>
    </Response>
    ```

### Twilio Incoming Call
- **Endpoint:** `POST http://localhost:8000/twilio/incoming`
- **Headers:** 
  - `Content-Type: application/json`
- **Request Body:**
    ```json
    {
      "To": "+1234567890",
      "From": "+0987654321",
      "CallStatus": "in-progress"
    }
    ```
- **Expected Response:**
    ```xml
    <Response>
      <Say>Connecting you to an agent now.</Say>
    </Response>
    ```

## Steps to Test in Postman

1. **Setup Postman:**
    - Open Postman and create a new collection.
    - Add a new request to the collection for each endpoint you want to test.

2. **Auth Endpoints:**
    - **Register a New User:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/auth/register`.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Login User:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/auth/login`.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Get Current User Token:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/auth/token`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Get Current User Information:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/auth/user`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Refresh Access Token:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/auth/refresh`.
        - Add the request body in JSON format.
        - Send the request and verify the response.

3. **Customer Endpoints:**
    - **Get Logged-In Customer Data:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/customers`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Get Specific Customer Data:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/customers/:uuid`.
        - Replace `:uuid` with the actual customer UUID.
        - Send the request and verify the response.

    - **Delete the Logged-In User:**
        - Set the request type to `DELETE`.
        - Enter the URL: `http://localhost:8000/customers`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Update Customer Credits by UUID:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/customers/:uuid/credits`.
        - Replace `:uuid` with the actual customer UUID.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Get Customer Data by Email:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/customers/email/:email`.
        - Replace `:email` with the actual customer email address.
        - Send the request and verify the response.

    - **Update Customer Profile:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/customers/update-profile`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

4. **Voice Agent Endpoints:**
    - **Create a Voice Agent:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Update a Voice Agent:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Retrieve All Voice Agents:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Retrieve a Single Voice Agent:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Delete a Voice Agent:**
        - Set the request type to `DELETE`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Update Last Trained Timestamp:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/trained`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Update Takeover Settings:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/takeover`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the query parameter `takeOverTimeout=<timeout_value>` if needed.
        - Send the request and verify the response.

    - **Update Private Settings:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/settings`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Get Voice Agent Permissions:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/permissions`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Fetch Detailed Voice Agent Data:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/details`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Update Twilio Phone Number:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/<VOICE_AGENT_ID>/twilio-phone`.
        - Replace `<VOICE_AGENT_ID>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **[Admin Only] Update System Messages for All Voice Agents:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/v1/voice-agents/update-system-messages`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

5. **Business Endpoints:**
    - **Create a Business:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/v1/business/:voice_agent_id`.
        - Replace `:voice_agent_id` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Update a Business:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/v1/business/<BUSINESS_ID>`.
        - Replace `<BUSINESS_ID>` with the actual business ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Delete a Business:**
        - Set the request type to `DELETE`.
        - Enter the URL: `http://localhost:8000/v1/business/<BUSINESS_ID>`.
        - Replace `<BUSINESS_ID>` with the actual business ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

6. **Training Endpoints:**
    - **Website Training:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/:voice_agent_id/training/website`.
        - Replace `:voice_agent_id` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Text Training:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/:voice_agent_id/training/text`.
        - Replace `:voice_agent_id` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **File Upload Training:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/:voice_agent_id/training/file`.
        - Replace `:voice_agent_id` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the form data with key `files` containing the file(s).
        - Send the request and verify the response.

    - **Audio Training:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/:voice_agent_id/training/audio`.
        - Replace `:voice_agent_id` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Add the form data with key `files` containing the audio file(s).
        - Send the request and verify the response.

7. **Scraping Endpoints:**
    - **Scrape Multiple Websites:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/scraping/scrape`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Scan URL Progress (SSE):**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/scraping`.
        - Add the `Authorization` header with the access token.
        - Add the query parameter `url=<full-url-to-scan>`.
        - Send the request and verify the response.

    - **Fetch URL:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/scraping/fetch-url`.
        - Add the `Authorization` header with the access token.
        - Add the query parameter `url=<url-to-fetch>`.
        - Send the request and verify the response.

8. **Context Endpoint:**
    - **Context Endpoint:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/context`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

9. **Agent Configuration:**
    - **Voice Agent and Business Configuration:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/agent-config/:voice_agent_id`.
        - Replace `:voice_agent_id` with the actual voice agent ID.
        - Send the request and verify the response.

10. **Functions Endpoints:**
    - **Create a Function:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/functions`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Get All Functions:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/functions`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Get Function by ID:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/functions/:id`.
        - Replace `:id` with the actual function ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Update a Function:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/functions/:id`.
        - Replace `:id` with the actual function ID.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Delete a Function:**
        - Set the request type to `DELETE`.
        - Enter the URL: `http://localhost:8000/functions/:id`.
        - Replace `:id` with the actual function ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Upload Files:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/functions/upload`.
        - Add the `Authorization` header with the access token.
        - Add the form data with key `files` containing the file(s).
        - Send the request and verify the response.

    - **Update Function Status:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/functions/:id/:status`.
        - Replace `:id` with the actual function ID.
        - Replace `:status` with the new status.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Get Functions by Assistant ID:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/functions/assistant/:assistant_id`.
        - Replace `:assistant_id` with the actual assistant ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **[Admin Only] Update Default Functions for All Voice Agents:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/functions/update-default-functions`.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

11. **Tools Endpoints:**
    - **Get Tools by Assistant ID:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/tools/:assistant_id`.
        - Replace `:assistant_id` with the actual assistant ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

    - **Get Function Data by Assistant ID:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/tools/function-data/:assistant_id`.
        - Replace `:assistant_id` with the actual assistant ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

12. **Realtime Endpoints:**
    - **Create Realtime Session:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/realtime/session/<voice_agent_id>`.
        - Replace `<voice_agent_id>` with the actual voice agent ID.
        - Add the `Authorization` header with the access token.
        - Send the request and verify the response.

13. **Appointments Endpoints:**
    - **Create a New Appointment:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/appointments`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Get Appointments by Phone Number:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/appointments/by-phone`.
        - Add the `Authorization` header with the access token.
        - Add the query parameters `phone_number` and `voice_agent_id`.
        - Send the request and verify the response.

    - **Get Booked Slots:**
        - Set the request type to `GET`.
        - Enter the URL: `http://localhost:8000/appointments/booked-slots`.
        - Add the `Authorization` header with the access token.
        - Add the query parameters `voice_agent_id` and `date`.
        - Send the request and verify the response.

    - **Update Appointment:**
        - Set the request type to `PATCH`.
        - Enter the URL: `http://localhost:8000/appointments`.
        - Add the `Authorization` header with the access token.
        - Add the request body in JSON format.
        - Send the request and verify the response.

14. **Audio Transcription Endpoints:**
    - **Transcribe Audio File:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/transcribe/audio`.
        - Add the `Content-Type` header with `multipart/form-data`.
        - Add the form data with key `file` containing the audio file.
        - Send the request and verify the response.

15. **Twilio-OpenAI Integration:**
    - **Twilio Welcome Endpoint:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/twilio/welcome`.
        - Add the `Content-Type` header with `application/json`.
        - Add the request body in JSON format.
        - Send the request and verify the response.

    - **Twilio Incoming Call:**
        - Set the request type to `POST`.
        - Enter the URL: `http://localhost:8000/twilio/incoming`.
        - Add the `Content-Type` header with `application/json`.
        - Add the request body in JSON format.
        - Send the request and verify the response.

## Testing with Swagger UI

1. **Access Swagger UI:**
    - Open your browser and navigate to `http://localhost:8000/api`.

2. **Explore Endpoints:**
    - Use the interactive interface to explore the available endpoints.
    - View request and response schemas for each endpoint.

3. **Test Endpoints:**
    - Use the "Try it out" feature to test endpoints directly from the browser.
    - Enter the required parameters and send the request.
    - Verify the response and check for any errors.

4. **Authentication:**
    - For endpoints that require authentication, add the `Authorization` header with the access token.
    - Ensure you have a valid token before testing authenticated endpoints.

5. **Error Handling:**
    - Check the response for any error messages.
    - Verify the status code and error details to troubleshoot issues.

6. **Documentation:**
    - Use the provided documentation to understand the expected behavior of each endpoint.
    - Refer to the request and response examples for guidance.

By following these steps, you can effectively test the application endpoints using Postman and Swagger UI. Ensure you have the necessary access tokens and valid request parameters for successful testing.