FROM maven:3.9.11-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
# Tests are executed as an independent quality gate before image packaging.
# Skipping test compilation here keeps a clean/offline production build lean.
RUN mvn -B -Dmaven.test.skip=true clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser && mkdir -p /app/data/uploads && chown -R appuser:appuser /app
COPY --from=build --chown=appuser:appuser /build/target/qa-platform-api-*.jar app.jar
USER appuser
EXPOSE 3000
ENTRYPOINT ["java","-XX:+UseContainerSupport","-XX:MaxRAMPercentage=75","-jar","/app/app.jar"]
