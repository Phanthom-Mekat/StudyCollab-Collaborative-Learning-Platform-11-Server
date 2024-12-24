const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://studycolab.netlify.app"], //replace with client address
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// cookie parser middleware
app.use(cookieParser());


// custom middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log('token inside the verifyToken', token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  //verify the token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ message: "Token verification failed: " + err.message });
    }
    // if there is no error,
    req.user = decoded;
    next();
  });
};


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zhb6u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const assignmentCollection = client
      .db("GroupStudy")
      .collection("assignment");
    const userCollection = client.db("GroupStudy").collection("users");
    const assignmentSubmissionCollection = client
      .db("GroupStudy")
      .collection("assignmentSubmission");

    // auth related apis
    app.post("/jwt", (req, res) => {
      const user = req.body;
      //create token
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // removing/clearing the JWT token after the user logs out
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // create a new assignment
    app.post("/create",verifyToken, async (req, res) => {
      const assignment = req.body;
      const result = await assignmentCollection.insertOne(assignment);
      res.json(result);
    });

    // get all assignments
    app.get("/create", async (req, res) => {
      const cursor = assignmentCollection.find({});
      const result = await cursor.toArray();
      res.json(result);
    });

    // get a single assignment
    app.get("/create/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.findOne(query);
      res.json(result);
    });

    app.put("/create/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: req.body.title,
          description: req.body.description,
          marks: parseInt(req.body.marks),
          thumbnailUrl: req.body.thumbnailUrl,
          difficultyLevel: req.body.difficultyLevel,
          dueDate: req.body.dueDate,
        },
      };
      const result = await assignmentCollection.updateOne(query, updateDoc);
      res.json(result);
    });

    // search by defficulty level and also normal search
    app.get("/create/search/:search", async (req, res) => {
      const search = req.params.search;
      const query = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };

      const result = await assignmentCollection.find(query).toArray();
      res.json(result);
    });

    app.get("/create/difficulty/:difficultyLevel", async (req, res) => {
      const { difficultyLevel } = req.params;
      const query = {};

      if (difficultyLevel !== "all") {
        query.difficultyLevel = difficultyLevel;
      }

      const result = await assignmentCollection.find(query).toArray();
      res.json(result);
    });

    app.get(
      "/create/search/difficulty/:difficultyLevel/:search",
      async (req, res) => {
        const search = req.params.search;
        const difficultyLevel = req.params.difficultyLevel;
        const query = {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
          difficultyLevel,
        };

        const result = await assignmentCollection.find(query).toArray();
        res.json(result);
      }
    );

    //delete an assignment who created
    app.delete("/create/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.deleteOne(query);
      res.json(result);
    });

    // users collection
    // users data
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user)
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // take assighnment by user

    app.post("/submitAssignment",verifyToken, async (req, res) => {
      const assignment = req.body;
      const result = await assignmentSubmissionCollection.insertOne(assignment);
      res.json(result);
    });

    app.get("/submitAssignment",verifyToken, async (req, res) => {
      const cursor = assignmentSubmissionCollection.find({});
      const result = await cursor.toArray();
      // console.log("Fetched assignments:", result);
      res.json(result);
    });
    // get all assignments submitted by a user
    app.get("/submitAssignment/:email",verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      // console.log(req.cookies);
      // console.log(req.user.email, req.params.email);
      if (req.user.email !== req.params.email) {
        return res.status(403).send({ message: 'forbidden access' });
    }
    
      const result = await assignmentSubmissionCollection.find(query).toArray();
      res.json(result);
    });

    app.put("/submitAssignment/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: req.body.status,
          examinerEmail: req.body.examinerEmail,
          examinerName: req.body.examinerName,
          obtainedMarks: req.body.obtainedMarks,
          feedback: req.body.feedback,
        },
      };
      const result = await assignmentSubmissionCollection.updateOne(
        query,
        updateDoc
      );
      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from my server");
});

app.listen(port, () => {
  console.log("My simple server is running at", port);
});

//
//
