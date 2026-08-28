FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/qa-platform-api-*.jar app.jar
EXPOSE 3000
ENTRYPOINT ["java","-XX:+UseContainerSupport","-XX:MaxRAMPercentage=75","-jar","/app/app.jar"]
