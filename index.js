const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin:["http://localhost:5173","http://localhost:5174"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nl88zl6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//middlewares
const logger = async(req, res, next) => {
  console.log('called', req.host, req.originalUrl);
  next();
}

const verifyToken = async(req, res, next) => {
  const token = req.cookies?.token;
  console.log('value of token in middleware', token)
  if(!token){
    return res.status(401).send({message: 'not authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded) => {
    //error
    if(err){
      console(err)
      return res.status(401).send({message:'unauthorized'})
    }
    console.log("value in the token", decoded)
    req.user = decoded
    next()
  })
  
}

async function run() {
  try {
    await client.connect();

    const serviceCollection = client.db('CarDoctor').collection('services');
    const bookingCollection = client.db('CarDoctor').collection('booking');

    //auth related api
    app.post('/jwt', logger, async(req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})


      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false, // http://localhost:5174/login
        // maxAge: '2h',
        // sameSite: 'none'
      })
      .send({success: true})
    })



    //services related api
    app.get('/services', logger, async (req, res) => {
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const options = {
        projection: {title: 1, price: 1, service_id: 1, img: 1},
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    })

    //bookings
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('token', req.cookies.token)
      console.log('user in the valid token', req.user)
      if(req.query.email !== req.user.email){
        return res.status(403).send({message:'forbidden access'})
      }
      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/bookings', async(req, res) =>{
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updateBooking = req.body;
      console.log(updateBooking);
      const updateDoc = {
        $set:{
          status: updateBooking.status
        },
      };
      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result);
    })

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doctor running')
})

app.listen(port, () => {
    console.log(`car doctor server is running on port ${port}`)
})