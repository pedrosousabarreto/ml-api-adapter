## Typescript implementation of [mojaloop/ml-api-adapter](https://github.com/mojaloop/ml-api-adapter) 

Significant changes from mojaloop's implementation (early March 2019):
- Typescript
- Node 10.15
- Simple framework for express microservices with dependency injection [node-microsvc-lib](https://www.npmjs.com/package/node-microsvc-lib)
- kafka-node implementation [kafka-node](https://www.npmjs.com/package/kafka-node)


See node-microsvc-lib [readme.md](https://github.com/pedrosousabarreto/node-microsvc-lib#readme) for more implementation details

---

## Install
```
npm install
```

## Run dev
```
npm run dev
```

## Build for prod usage
Dev:
```
npm run build
```

## Run prod (after build)
```
npm run prod
```

---

## Requirements

#### Node v10.15.0

#### Kafka 
```
docker run -td --name=kafkatest -p 2181:2181 -p 9092:9092 -e ADVERTISED_HOST=localhost johnnypark/kafka-zookeeper
```

#### Zipkin (optional) 
```
wget -O zipkin.jar 'https://search.maven.org/remote_content?g=io.zipkin.java&a=zipkin-server&v=LATEST&c=exec'
java -jar ./zipkin.jar
```

---

### TODO
- add unit and coverage tests