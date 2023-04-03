import cors from 'cors';
import dotenv from 'dotenv';
import express, { Express, Request, Response } from 'express';
import { auth } from 'express-oauth2-jwt-bearer';
import { GetAllCategoriesAction } from './contexts/links/actions/GetAllCategoriesAction';
import { GetAllLinksAction } from './contexts/links/actions/GetAllLinksAction';
import { GetLinkByIdAction } from './contexts/links/actions/GetLinkByIdAction';
import { CategoryRepositoryPG } from './contexts/links/infrastructure/persistence/repositories/CategoryRepositoryPG';
import { LinkRepositoryPG } from './contexts/links/infrastructure/persistence/repositories/LinkRepositoryPG';
import { CreateUserAction } from './contexts/users/actions/CreateUserAction';
import { SignInAction } from './contexts/users/actions/SignInAction';
import { EmailExistsException } from './contexts/users/domain/exceptions/EmailExistsException';
import { MandatoryFieldEmptyException } from './contexts/users/domain/exceptions/MandatoryFieldEmptyException';
import { ShortPasswordException } from './contexts/users/domain/exceptions/ShortPasswordException';
import { UsernameExistsException } from './contexts/users/domain/exceptions/UsernameExistsException';
import { UserNotFoundException } from './contexts/users/domain/exceptions/UserNotFoundException';
import { WrongPasswordException } from './contexts/users/domain/exceptions/WrongPasswordException';
import { UserRepositoryPG } from './contexts/users/infrastructure/persistence/repositories/UserRepositoryPG';
import dataSource from './data-source';
import { AuthServiceAuth0 } from './contexts/users/infrastructure/services/AuthServiceAuth0';
import { ResetPasswordAction } from './contexts/users/actions/ResetPasswordAction';
import { ResetTokenRepositoryPG } from './contexts/users/infrastructure/persistence/repositories/ResetTokenRepositoryPG';
import { MailerServiceGD } from './contexts/users/infrastructure/services/MailerServiceGD';
import { RecoveryPasswordAction } from './contexts/users/actions/RecoveryPasswordAction';
import { TokenNotFoundException } from './contexts/users/domain/exceptions/TokenNotFoundException';
import { TokenIsExpiredException } from './contexts/users/domain/exceptions/TokenIsExpiredException';
import { CreateLinkAction } from './contexts/links/actions/CreateLinkAction';
import { LinkExistsException } from './contexts/links/domain/exceptions/LinkExistsException';
import { CategoryRestrictionException } from './contexts/links/domain/exceptions/CategoryRestrictionException';
import { CategoryNotFoundException } from './contexts/links/domain/exceptions/CategoryNotFoundException';
import ogs from 'ts-open-graph-scraper'
import { CreateViewedLinkByUserDataAction } from './contexts/links/actions/CreateViewedLinkByUserDataAction';
import { ViewedLinkByUserDataRepositoryPG } from './contexts/links/infrastructure/persistence/repositories/ViewedLinkByUserDataRepositoryPG';
import { LinkNotFoundException } from './contexts/links/domain/exceptions/LinkNotFoundException';
import { DataDoesExistException } from './contexts/links/domain/exceptions/DataDoesExistException';
import { DateNotValidException } from './contexts/voting/domain/exceptions/DateNotValidException';
import { GetVotingStatusAction } from './contexts/voting/actions/GetVotingStatus';
import { CreateVotingAction } from './contexts/voting/actions/CreateVotingAction';
import { VoteRepositoryPG } from './contexts/voting/infrastructure/persistence/repositories/VoteRepositoryPG';

const app: Express = express();

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

dotenv.config();
app.use(cors({ origin: process.env.CLIENT }));

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256'
});

app.get('/', (req: Request, res: Response) => {
  res.send('Butterfy API');
});

app.post('/user', async (req: Request, res: Response) => {
  const createUserAction = new CreateUserAction(
    new UserRepositoryPG(dataSource),
  );
  createUserAction
    .execute(req.body.email, req.body.username, req.body.password)
    .then(() => {
      res.status(201);
      res.send({ message: 'User created!' });
    })
    .catch((error) => {
      switch (error.constructor) {
        case MandatoryFieldEmptyException:
          res.status(400);
          res.send({ message: 'Bad request' });
          break;
        case ShortPasswordException:
          res.status(400);
          res.send({ message: 'Password is too short!' });
          break;
        case UsernameExistsException:
        case EmailExistsException:
          res.status(403);
          res.send({ message: 'User exist!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.status(500);
      }
    });
});

app.post('/signin', async (req: Request, res: Response) => {
  const signInAction = new SignInAction(
    new UserRepositoryPG(dataSource),
    new AuthServiceAuth0()
  );
  signInAction
    .execute(req.body.password, req.body.username, req.body.email)
    .then((result) => {
      res.status(200);
      res.send(result);
    })
    .catch((error) => {
      switch (error.constructor) {
        case UserNotFoundException:
        case WrongPasswordException:
          res.status(401);
          res.send({ message: 'Sign in not successful!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.status(500);
      }
    });
});

app.post('/recovery-password', async (req: Request, res: Response) => {
  const recoveryPasswordAction = new RecoveryPasswordAction(
    new UserRepositoryPG(dataSource),
    new ResetTokenRepositoryPG(dataSource),
    new MailerServiceGD(),
  );
  recoveryPasswordAction
    .execute(req.body.email)
    .then(() => {
      res.status(200);
      res.send({ message: 'The mail was sent!' });
    })
    .catch((error: { constructor: any; }) => {
      switch (error.constructor) {
        case MandatoryFieldEmptyException:
          res.status(400);
          res.send({ message: 'Email is mandatory!' });
          break;
        case UserNotFoundException:
          res.status(200);
          res.send({ message: 'The mail was sent!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.send(500);
      }
    });
});

app.post('/reset-password', async (req: Request, res: Response) => {
  const resetPasswordAction = new ResetPasswordAction(
    new UserRepositoryPG(dataSource),
    new ResetTokenRepositoryPG(dataSource)
  );
  resetPasswordAction
    .execute(req.body.userUuid, req.body.token, req.body.password)
    .then(() => {
      res.status(200);
      res.send({ message: 'Password reset!' });
    })
    .catch((error) => {
      switch (error.constructor) {
        case MandatoryFieldEmptyException:
          res.status(400);
          res.send({ message: 'Bad request' });
          break;
        case ShortPasswordException:
          res.status(400);
          res.send({ message: 'Password is too short!' });
          break;
        case UserNotFoundException:
        case TokenNotFoundException:
          res.status(404);
          res.send({ message: 'Resource not found!' });
          break;
        case TokenIsExpiredException:
          res.status(401);
          res.send({ message: 'Token is expired!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.send(500);
      }
    });
});

app.get('/categories', async (req: Request, res: Response) => {
  const getAllCategoriesAction = new GetAllCategoriesAction(
    new CategoryRepositoryPG(dataSource),
  );

  getAllCategoriesAction
    .execute()
    .then((result) => {
      res.status(200);
      res.send({ categories: result[0], total: result[1] });
    })
    .catch((error) => {
      console.log(
        'Failed to do something async with an unspecified error: ',
        error,
      );
      return res.send(500);
    });
});

app.get('/links', async (req: Request, res: Response) => {
  const getAllLinksAction = new GetAllLinksAction(
    new LinkRepositoryPG(dataSource),
  );

  let page: number = 0;
  if (req.query.page) page = +req.query.page;

  getAllLinksAction
    .execute(req.query.sort as string, req.query.categories as string, page)
    .then((result) => {
      res.status(200);
      res.send({ links: result[0], total: result[1] });
    })
    .catch((error) => {
      console.log(
        'Failed to do something async with an unspecified error: ',
        error,
      );
      return res.send(500);
    });
});

app.get('/links/:id', async (req: Request, res: Response) => {
  const getLinkByIdAction = new GetLinkByIdAction(
    new LinkRepositoryPG(dataSource),
  );

  const link = await getLinkByIdAction
    .execute(+req.params.id as number)
    .catch((error: any) => {
      console.log(
        'Failed to do something async with an unspecified error: ',
        error,
      );
      return res.send(500);
    });

  if (link) {
    res.status(200);
    res.send(link);
  } else {
    res.status(400);
    res.send({ message: 'Link not exists!' });
  }
});

app.post('/links', checkJwt, async (req: Request, res: Response) => {
  const createLinkAction = new CreateLinkAction(
    new LinkRepositoryPG(dataSource),
    new CategoryRepositoryPG(dataSource),
    new UserRepositoryPG(dataSource)
  );

  createLinkAction
    .execute(req.body)
    .then(() => {
      res.status(201);
      res.send({ message: 'Link created!' });
    })
    .catch((error) => {
      switch (error.constructor) {
        case MandatoryFieldEmptyException:
          res.status(400);
          res.send({ message: 'Bad request' });
          break;
        case CategoryRestrictionException:
          res.status(400);
          res.send({ message: 'Category limit restriction!' });
          break;
        case CategoryNotFoundException:
          res.status(400);
          res.send({ message: 'Category not found!' });
          break;
        case UserNotFoundException:
          res.status(400);
          res.send({ message: 'User not found!' });
          break;
        case LinkExistsException:
          res.status(403);
          res.send({ message: 'Link already exists!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.send(500);
      }
    });
});

app.post('/link-preview-data', checkJwt,  async (req: Request, res: Response) => {
  const url = req.body.url;

  if (!url) {
    res.status(400);
    res.send({ message: 'Bad request' });
    return;
  }

  ogs(url).then((data:any) => {
    const { response, ...result } = data;
    res.status(200);
    res.send(result);
  })
  .catch((error:any) => {
    console.log(
      'Failed to do something async with an unspecified error: ',
      error,
    );
    return res.status(500);
  });

});

app.post('/viewed-link-user', checkJwt,  async (req: Request, res: Response) => {
  const createViewedLinkByUserDataAction = new CreateViewedLinkByUserDataAction(
    new UserRepositoryPG(dataSource),
    new LinkRepositoryPG(dataSource),
    new ViewedLinkByUserDataRepositoryPG(dataSource)
  );

  createViewedLinkByUserDataAction
    .execute(req.body.userUuid, req.body.linkUuid)
    .then(() => {
      res.status(201);
      res.send({ message: 'Data created!' });
    })
    .catch((error) => {
      switch (error.constructor) {
        case MandatoryFieldEmptyException:
          res.status(400);
          res.send({ message: 'Bad request' });
          break;
        case UserNotFoundException:
          res.status(400);
          res.send({ message: 'User not found!' });
          break;
        case LinkNotFoundException:
          res.status(400);
          res.send({ message: 'Link not found!' });
          break;
        case DataDoesExistException:
          res.status(403);
          res.send({ message: 'Data already exists!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.send(500);
      }
    });

});

app.post('/voting-status', async (req: Request, res: Response) => {
  const getVotingStatusAction = new GetVotingStatusAction();

  getVotingStatusAction
    .execute(new Date(req.body.date))
    .then((votingStatus) => {
      res.status(200);
      res.send(votingStatus);
    })
    .catch((error) => {
      switch (error.constructor) {
        case DateNotValidException:
          res.status(400);
          res.send({ message: 'Invalid date!' });
          break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.send(500);
      }
    });

});

app.post('/votes', checkJwt, async (req: Request, res: Response) => {
  const createVoteAction = new CreateVotingAction(
    new ViewedLinkByUserDataRepositoryPG(dataSource),
    new VoteRepositoryPG(dataSource)
  );

  createVoteAction
    .execute(
      req.body.userUuid,
      req.body.votes,
      req.body.cycle
    )
    .then(() => {
      res.status(200);
      res.send('');
    })
    .catch((error) => {
      switch (error.constructor) {
        // case DateNotValidException:
        //   res.status(400);
        //   res.send({ message: 'Invalid date!' });
        //   break;
        default:
          console.log(
            'Failed to do something async with an unspecified error: ',
            error,
          );
          return res.send(500);
      }
    });

});

export default app;
