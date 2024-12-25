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
    origin: [
      "http://localhost:5173",
      "https://studycolab.netlify.app",
      "https://studycollab-64f2a.web.app",
    ], //replace with client address
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
    app.post("/create", verifyToken, async (req, res) => {
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

    app.put("/create/:id", verifyToken, async (req, res) => {
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

    app.post("/submitAssignment", verifyToken, async (req, res) => {
      const assignment = req.body;
      const result = await assignmentSubmissionCollection.insertOne(assignment);
      res.json(result);
    });

    app.get("/submitAssignment", verifyToken, async (req, res) => {
      const cursor = assignmentSubmissionCollection.find({});
      const result = await cursor.toArray();
      // console.log("Fetched assignments:", result);
      res.json(result);
    });
    // get all assignments submitted by a user
    app.get("/submitAssignment/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      // console.log(req.cookies);
      // console.log(req.user.email, req.params.email);
      if (req.user.email !== req.params.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const result = await assignmentSubmissionCollection.find(query).toArray();
      res.json(result);
    });

    // app.put("/submitAssignment/:id", verifyToken, async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: {
    //       status: req.body.status,
    //       examinerEmail: req.body.examinerEmail,
    //       examinerName: req.body.examinerName,
    //       obtainedMarks: req.body.obtainedMarks,
    //       feedback: req.body.feedback,
    //     },
    //   };
    //   const result = await assignmentSubmissionCollection.updateOne(
    //     query,
    //     updateDoc
    //   );
    //   res.json(result);
    // });

    // Add new collections
    const achievementsCollection = client
      .db("GroupStudy")
      .collection("achievements");
    const userStatsCollection = client.db("GroupStudy").collection("userStats");

    // Point system constants
    const POINTS = {
      SUBMIT_ASSIGNMENT: 10,
      GRADE_ASSIGNMENT: 5,
      PERFECT_SCORE: 15,
      STREAK_BONUS: 20,
      MONTHLY_TOP_THREE: [50, 30, 20], // Points for monthly leaderboard positions
    };

    // Achievement definitions
    const ACHIEVEMENTS = {
      FIRST_SUBMISSION: {
        id: "first_submission",
        name: "First Steps",
        description: "Submit your first assignment",
        points: 50,
        icon: "🎯",
      },
      PERFECT_STREAK: {
        id: "perfect_streak",
        name: "Perfect Week",
        description: "Maintain a 7-day submission streak",
        points: 100,
        icon: "🔥",
      },
      GRADING_MASTER: {
        id: "grading_master",
        name: "Grading Master",
        description: "Grade 10 assignments",
        points: 75,
        icon: "📝",
      },
      TOP_PERFORMER: {
        id: "top_performer",
        name: "Top Performer",
        description: "Achieve #1 in monthly leaderboard",
        points: 200,
        icon: "👑",
      },
    };

    // Initialize user stats
    app.post("/userStats", verifyToken, async (req, res) => {
      const stats = {
        userEmail: req.body.email,
        points: 0,
        assignmentsCompleted: 0,
        assignmentsGraded: 0,
        perfectScores: 0,
        currentStreak: 0,
        lastActivityDate: new Date(),
        achievements: [],
        rank: "Novice",
      };
      const result = await userStatsCollection.insertOne(stats);
      res.json(result);
    });

    // Update points and check achievements after submission
    // Update points and check achievements after submission
    app.put("/submitAssignment/:id", verifyToken, async (req, res) => {
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

      // 1. First update the assignment submission
      const submissionResult = await assignmentSubmissionCollection.updateOne(
        query,
        updateDoc
      );

      // 2. Get the submission to access student's email
      const submission = await assignmentSubmissionCollection.findOne(query);

      // 3. Update Student's Stats
      const studentEmail = submission.userEmail;
      let studentStats = await userStatsCollection.findOne({
        userEmail: studentEmail,
      });

      // Create student stats if they don't exist
      if (!studentStats) {
        studentStats = {
          userEmail: studentEmail,
          userName: submission.userName,
          points: 0,
          assignmentsCompleted: 0,
          assignmentsGraded: 0,
          perfectScores: 0,
          currentStreak: 0,
          lastActivityDate: new Date(),
          achievements: [],
          monthlyPoints: 0,
          rank: "Novice",
        };
        await userStatsCollection.insertOne(studentStats);
      }

      // Calculate student points
      let studentPointsEarned = POINTS.SUBMIT_ASSIGNMENT;
      let studentNewAchievements = [];

      // Check for perfect score
      if (parseInt(req.body.obtainedMarks) === parseInt(submission.marks)) {
        studentPointsEarned += POINTS.PERFECT_SCORE;
        studentStats.perfectScores++;

        if (studentStats.perfectScores === 5) {
          studentNewAchievements.push(ACHIEVEMENTS.PERFECT_SCORER);
        }
      }

      // Check for first submission achievement
      if (studentStats.assignmentsCompleted === 0) {
        studentNewAchievements.push(ACHIEVEMENTS.FIRST_SUBMISSION);
      }

      // Update student streak
      const studentStreak = await updateStreak(studentEmail);
      if (studentStreak?.newAchievements?.length > 0) {
        studentNewAchievements.push(...studentStreak.newAchievements);
        studentPointsEarned += studentStreak.bonusPoints;
      }

      // Update student stats
      await userStatsCollection.updateOne(
        { userEmail: studentEmail },
        {
          $inc: {
            points: studentPointsEarned,
            monthlyPoints: studentPointsEarned,
            assignmentsCompleted: 1,
            perfectScores:
              studentStats.perfectScores > studentStats.perfectScores ? 1 : 0,
          },
          $set: {
            lastActivityDate: new Date(),
            currentStreak:
              studentStreak?.newStreak || studentStats.currentStreak,
          },
          $push: {
            achievements: {
              $each: studentNewAchievements,
            },
          },
        }
      );

      // 4. Update Examiner's Stats
      const examinerEmail = req.body.examinerEmail;
      let examinerStats = await userStatsCollection.findOne({
        userEmail: examinerEmail,
      });

      // Create examiner stats if they don't exist
      if (!examinerStats) {
        examinerStats = {
          userEmail: examinerEmail,
          userName: req.body.examinerName,
          points: 0,
          assignmentsCompleted: 0,
          assignmentsGraded: 0,
          perfectScores: 0,
          currentStreak: 0,
          lastActivityDate: new Date(),
          achievements: [],
          monthlyPoints: 0,
          rank: "Novice",
        };
        await userStatsCollection.insertOne(examinerStats);
      }

      // Calculate examiner points
      let examinerPointsEarned = POINTS.GRADE_ASSIGNMENT;
      let examinerNewAchievements = [];

      // Check for grading master achievement
      if (examinerStats.assignmentsGraded + 1 === 10) {
        examinerNewAchievements.push(ACHIEVEMENTS.GRADING_MASTER);
        examinerPointsEarned += ACHIEVEMENTS.GRADING_MASTER.points;
      }

      // Update examiner stats
      await userStatsCollection.updateOne(
        { userEmail: examinerEmail },
        {
          $inc: {
            points: examinerPointsEarned,
            monthlyPoints: examinerPointsEarned,
            assignmentsGraded: 1,
          },
          $set: {
            lastActivityDate: new Date(),
          },
          $push: {
            achievements: {
              $each: examinerNewAchievements,
            },
          },
        }
      );

      // 5. Get updated rankings for both users
      const leaderboard = await userStatsCollection
        .find({})
        .sort({ points: -1 })
        .toArray();

      const studentRank =
        leaderboard.findIndex((user) => user.userEmail === studentEmail) + 1;
      const examinerRank =
        leaderboard.findIndex((user) => user.userEmail === examinerEmail) + 1;

      // 6. Send response with all updates
      res.json({
        submission: submissionResult,
        student: {
          pointsEarned: studentPointsEarned,
          newAchievements: studentNewAchievements,
          currentStreak: studentStreak?.newStreak || studentStats.currentStreak,
          rank: studentRank,
        },
        examiner: {
          pointsEarned: examinerPointsEarned,
          newAchievements: examinerNewAchievements,
          rank: examinerRank,
        },
      });
    });

    app.post("/initializeStats", verifyToken, async (req, res) => {
      const { email, name } = req.body;

      const stats = {
        userEmail: email,
        userName: name,
        points: 0,
        assignmentsCompleted: 0,
        assignmentsGraded: 0,
        perfectScores: 0,
        currentStreak: 0,
        lastActivityDate: new Date(),
        achievements: [],
        monthlyPoints: 0,
        lastMonthReset: new Date(),
        rank: "Novice",
      };

      const result = await userStatsCollection.insertOne(stats);
      res.json(result);
    });

    // Update points and achievements when grading assignments
    app.put("/updateGraderStats", verifyToken, async (req, res) => {
      const { examinerEmail } = req.body;

      const stats = await userStatsCollection.findOne({
        userEmail: examinerEmail,
      });
      if (!stats) return res.status(404).json({ message: "Stats not found" });

      let pointsEarned = POINTS.GRADE_ASSIGNMENT;
      let newAchievements = [];

      // Check for grading master achievement
      if (stats.assignmentsGraded + 1 === 10) {
        newAchievements.push(ACHIEVEMENTS.GRADING_MASTER);
        pointsEarned += ACHIEVEMENTS.GRADING_MASTER.points;
      }

      const result = await userStatsCollection.updateOne(
        { userEmail: examinerEmail },
        {
          $inc: {
            points: pointsEarned,
            monthlyPoints: pointsEarned,
            assignmentsGraded: 1,
          },
          $push: {
            achievements: { $each: newAchievements },
          },
        }
      );

      res.json({ result, pointsEarned, newAchievements });
    });

    // Get monthly leaderboard
    app.get("/monthlyLeaderboard", async (req, res) => {
      const result = await userStatsCollection
        .find({})
        .sort({ monthlyPoints: -1 })
        .limit(10)
        .toArray();
      res.json(result);
    });

    // Reset monthly points (should be called via cron job at month end)
    app.post("/resetMonthlyPoints", async (req, res) => {
      // Get top 3 before reset
      const topThree = await userStatsCollection
        .find({})
        .sort({ monthlyPoints: -1 })
        .limit(3)
        .toArray();

      // Award bonus points to top 3
      for (let i = 0; i < topThree.length; i++) {
        await userStatsCollection.updateOne(
          { userEmail: topThree[i].userEmail },
          {
            $inc: { points: POINTS.MONTHLY_TOP_THREE[i] },
            $push: {
              achievements: i === 0 ? ACHIEVEMENTS.TOP_PERFORMER : null,
            },
          }
        );
      }

      // Reset monthly points for all users
      await userStatsCollection.updateMany(
        {},
        {
          $set: {
            monthlyPoints: 0,
            lastMonthReset: new Date(),
          },
        }
      );

      res.json({ message: "Monthly points reset successful" });
    });

    // Update streak and check for streak-based achievements
    const updateStreak = async (userEmail) => {
      const stats = await userStatsCollection.findOne({ userEmail });
      if (!stats) return null;

      const lastActivity = new Date(stats.lastActivityDate);
      const today = new Date();
      const daysDiff = Math.floor(
        (today - lastActivity) / (1000 * 60 * 60 * 24)
      );

      let newStreak = daysDiff === 1 ? stats.currentStreak + 1 : 1;
      let newAchievements = [];
      let bonusPoints = 0;

      // Check for streak achievements
      if (newStreak === 7) {
        newAchievements.push(ACHIEVEMENTS.PERFECT_STREAK);
        bonusPoints += ACHIEVEMENTS.PERFECT_STREAK.points;
      }

      await userStatsCollection.updateOne(
        { userEmail },
        {
          $set: {
            currentStreak: newStreak,
            lastActivityDate: today,
          },
          $push: {
            achievements: { $each: newAchievements },
          },
          $inc: {
            points: bonusPoints,
            monthlyPoints: bonusPoints,
          },
        }
      );

      return { newStreak, newAchievements, bonusPoints };
    };
    // Get leaderboard
    app.get("/leaderboard", async (req, res) => {
      const result = await userStatsCollection
        .find({})
        .sort({ points: -1 })
        .limit(10)
        .toArray();
      res.json(result);
    });

    // Get user stats
    app.get("/userStats/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await userStatsCollection.findOne({ userEmail: email });
      res.json(result);
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
