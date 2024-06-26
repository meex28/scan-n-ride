import { Api, Cognito, StackContext, Table } from "sst/constructs";

export function API({ stack, app }: StackContext) {
  const ticketsTable = new Table(stack, "Tickets", {
    primaryIndex: { partitionKey: "uuid", sortKey: "createdAt" },
    fields: {
      uuid: "string",
      createdAt: "string",
      validUntil: "string",
      type: "string",
      line: "string",
      vehicleNumber: "string",
      ownerUserSub: "string"
    },
  });

  const auth = new Cognito(stack, "Auth", {
    login: ["username"],
    cdk: {
      userPoolClient: {
        generateSecret: false,
        authFlows: {
          userPassword: true
        },
        oAuth: {
          callbackUrls: ["http://localhost:8081/auth", "http://localhost:8081"]
        }
      }
    }
  });

  const cognitoDomain = auth.cdk.userPool.addDomain("AuthDomain", {
    cognitoDomain: {
      domainPrefix: `${app.stage}-scan-n-ride`
    }
  })

  const api = new Api(stack, "ScanNRideApi", {
    authorizers: {
      jwt: {
        type: "user_pool",
        userPool: {
          id: auth.userPoolId,
          clientIds: [auth.userPoolClientId],
        },
      },
    },
    defaults: {
      function: {
        bind: [ticketsTable],
      },
      authorizer: "jwt"
    },
    routes: {
      "POST /ticket": "packages/functions/src/create_ticket.handler",
      "GET /ticket": "packages/functions/src/get_user_tickets.handler",
      "GET /vehicle/lines": {
        function: "packages/functions/src/get_vehicles_lines.handler",
        authorizer: "none"
      },
      "GET /vehicle": {
        function: "packages/functions/src/get_vehicles.handler",
        authorizer: "none"
      },
    },
  });

  auth.attachPermissionsForAuthUsers(stack, [api]);

  stack.addOutputs({
    ApiEndpoint: api.url,
    UserPoolId: auth.userPoolId,
    IdentityPoolId: auth.cognitoIdentityPoolId,
    UserPoolClientId: auth.userPoolClientId
  });

  return {
    ticketsTable,
    api,
    auth,
  };
}
