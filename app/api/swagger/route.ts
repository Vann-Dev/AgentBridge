const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AgentBridge API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          docExpansion: "list",
          operationsSorter: "method",
          tagsSorter: (a, b) => {
            const order = ["Profile", "Agents", "Projects", "Tasks"]
            return order.indexOf(a) - order.indexOf(b)
          },
          presets: [SwaggerUIBundle.presets.apis],
          layout: "BaseLayout"
        })
      }
    </script>
  </body>
</html>`

export function GET() {
  return new Response(swaggerHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })
}
